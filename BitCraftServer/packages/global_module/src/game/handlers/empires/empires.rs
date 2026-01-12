use crate::game::game_state;
use crate::game::handlers::authentication::has_role;
use crate::game::reducer_helpers::timer_helpers::now_plus_secs;
use crate::game::reducer_helpers::user_text_input_helpers::{is_user_text_input_valid, sanitize_user_inputs};
use crate::inter_module::send_inter_module_message;
use crate::messages::authentication::Role;
use crate::messages::components::*;
use crate::messages::global::{player_shard_state, user_region_state, PlayerVoteState, PlayerVoteType};
use crate::messages::inter_module::{MessageContentsV3, OnEmpireBuildingDeletedMsg, OnPlayerLeftEmpireMsg};
use crate::messages::static_data::*;
use crate::{empire_rank_desc, empire_territory_desc, parameters_desc_v2, unwrap_or_err, SmallHexTile, TerrainChunkState};
use bitcraft_macro::shared_table_reducer;
use spacetimedb::{log, ReducerContext, Table};

use crate::messages::empire_schema::*;
use crate::messages::empire_shared::*;

#[spacetimedb::reducer]
#[shared_table_reducer]
pub fn empire_form(ctx: &ReducerContext, request: EmpireFormRequest) -> Result<(), String> {
    let actor_id = game_state::actor_id(&ctx, true)?;

    UserModerationState::validate_chat_privileges(ctx, actor_id, "Your naming priveleges have been suspended")?;

    if let Err(_) = is_user_text_input_valid(&request.empire_name, 35, true) {
        return Err("Invalid characters in the empire name".into());
    }

    if ctx.db.empire_player_data_state().entity_id().find(&actor_id).is_some() {
        return Err("Player is already a member of an empire".into());
    }

    let claim = unwrap_or_err!(
        ctx.db.claim_state().owner_building_entity_id().find(&request.building_entity_id),
        "This is not a claim"
    );

    if claim.owner_player_entity_id != actor_id {
        return Err("Not the owner of this claim".into());
    }

    if ctx
        .db
        .empire_state()
        .capital_building_entity_id()
        .find(&request.building_entity_id)
        .is_some()
    {
        return Err("Already the capital of an empire".into());
    }

    if ctx.db.empire_state().name().find(&request.empire_name).is_some() {
        return Err("An empire with this name already exists".into());
    }

    let mut settlement = unwrap_or_err!(
        ctx.db
            .empire_settlement_state()
            .building_entity_id()
            .find(&request.building_entity_id),
        "This claim does not have the tech to form an empire"
    );

    if settlement.empire_entity_id != 0 {
        return Err("This claim is already part of an empire".into());
    }

    if ctx.db.empire_color_desc().id().find(&request.color1_id).is_none()
        || ctx.db.empire_color_desc().id().find(&request.color2_id).is_none()
    {
        return Err("Invalid empire colors".into());
    }

    let params = ctx.db.parameters_desc_v2().version().find(&0).unwrap();

    let mut vault = ctx.db.player_shard_state().entity_id().find(&actor_id).unwrap();
    let shards_cost = params.empire_shard_cost as u32;
    if vault.shards < shards_cost {
        return Err(format!("You need {{0}} shards to create a new empire|~{shards_cost}"));
    }
    vault.shards -= shards_cost;
    ctx.db.player_shard_state().entity_id().update(vault);

    let empire_entity_id = game_state::create_entity(ctx);

    let empire_default_nobility_threshold = params.empire_default_nobility_threshold;

    // Create Empire
    let empire = EmpireState {
        entity_id: empire_entity_id,
        capital_building_entity_id: request.building_entity_id,
        name: request.empire_name,
        shard_treasury: params.empire_starting_shards as u32,
        nobility_threshold: empire_default_nobility_threshold,
        num_claims: 1,
        location: settlement.location,
    };
    EmpireState::insert_shared(ctx, empire, crate::inter_module::InterModuleDestination::AllOtherRegions);
    ctx.db.empire_log_state().try_insert(EmpireLogState {
        entity_id: empire_entity_id,
        last_posted: 0,
    })?;
    ctx.db.empire_emblem_state().insert(EmpireEmblemState {
        entity_id: empire_entity_id,
        icon_id: request.icon_id,
        shape_id: request.shape_id,
        color1_id: request.color1_id,
        color2_id: request.color2_id,
    });
    ctx.db.empire_directive_state().insert(EmpireDirectiveState {
        entity_id: empire_entity_id,
        directive_message: String::new(),
        directive_message_timestamp: None,
    });

    EmpirePlayerDataState::new(ctx, actor_id, empire_entity_id, 0 /*Emperor*/)?;

    ctx.db.empire_player_log_state().try_insert(EmpirePlayerLogState {
        entity_id: actor_id,
        empire_entity_id,
        last_viewed: 0,
    })?;

    // Create default ranks for the new empire
    for rank_desc in ctx.db.empire_rank_desc().iter() {
        let rank_entity_id = game_state::create_entity(ctx);
        let title = rank_desc.title;
        let permissions = rank_desc.permissions;

        EmpireRankState::insert_shared(
            ctx,
            EmpireRankState {
                entity_id: rank_entity_id,
                empire_entity_id,
                rank: rank_desc.rank as u8,
                title,
                permissions,
            },
            crate::inter_module::InterModuleDestination::AllOtherRegions,
        );
    }

    settlement.empire_entity_id = empire_entity_id;
    EmpireSettlementState::update_shared(ctx, settlement, crate::inter_module::InterModuleDestination::AllOtherRegions);

    EmpireState::update_empire_upkeep(ctx, empire_entity_id);

    EmpireState::update_crown_status(ctx, empire_entity_id);

    Ok(())
}

/*
#[spacetimedb::reducer]
pub fn empire_invite_claim(ctx: &ReducerContext, request: EmpireInviteClaim) -> Result<(), String> {
    let actor_id = game_state::actor_id(&ctx)?;
    PlayerTimestampState::refresh(actor_id, ctx.timestamp);

    let target_claim = unwrap_or_err!(
        ctx.db.claim_description_state().owner_building_entity_id().find(&request.building_entity_id),
        "Not a claim building"
    );

    if !EmpirePlayerDataState::has_permission(actor_id, EmpirePermission::InviteSettlementToEmpire) {
        return Err("You don't have the permissions to invite a settlement into your empire".into());
    }

    if ctx.db.empire_settlement_state().entity_id().find(&request.building_entity_id).is_none() {
        return Err("This claim does not have the empire tech".into());
    };

    // Leave [30] seconds to answer the vote.
    // Todo: put that as a parameter somewhere.
    PlayerVoteState::insert_with_end_timer(
        PlayerVoteType::JoinEmpire,
        actor_id,
        vec![actor_id, target_claim.owner_player_entity_id],
        true,
        1.0,
        30.0,
        request.building_entity_id,
        0,
    );

    Ok(())
}

#[spacetimedb::reducer]
pub fn empire_expel_claim(ctx: &ReducerContext, building_entity_id: u64) -> Result<(), String> {
    let actor_id = game_state::actor_id(&ctx)?;
    PlayerTimestampState::refresh(actor_id, ctx.timestamp);

    let target_settlement = unwrap_or_err!(
        ctx.db.empire_settlement_state().entity_id().find(&building_entity_id),
        "Not a settlement building"
    );

    let player_data = unwrap_or_err!(ctx.db.empire_player_data_state().entity_id().find(&actor_id), "Not part of an empire");
    if player_data.empire_entity_id != target_settlement.empire_entity_id {
        return Err("You are not part of that settlement's empire".into());
    }

    if !EmpirePlayerDataState::has_permission(actor_id, EmpirePermission::InviteSettlementToEmpire) {
        return Err("You don't have the permissions to expel a settlement from your empire".into());
    }

    let claim_name = ctx.db.claim_description_state().owner_building_entity_id().find(&building_entity_id)
        .unwrap()
        .name;
    target_settlement.leave_empire(claim_name);

    Ok(())
}
*/

#[spacetimedb::reducer]
#[shared_table_reducer]
pub fn empire_submit(ctx: &ReducerContext, new_empire_entity_id: u64) -> Result<(), String> {
    let actor_id = game_state::actor_id(&ctx, true)?;

    let player_empire_data = unwrap_or_err!(
        ctx.db.empire_player_data_state().entity_id().find(&actor_id),
        "You are not part of an empire"
    );

    if player_empire_data.rank != 0 {
        return Err("Only the empire leader can submit the empire to another".into());
    }

    let empire_state = unwrap_or_err!(
        ctx.db.empire_state().entity_id().find(&player_empire_data.empire_entity_id),
        "You are part of an empire that does not exist. How is that possible?"
    );

    let target_emperor = unwrap_or_err!(
        ctx.db
            .empire_player_data_state()
            .empire_entity_id()
            .filter(new_empire_entity_id)
            .filter(|data| data.rank == 0)
            .next(),
        "That empire no longer exist"
    );

    // Leave [30] seconds to answer the vote.
    // Todo: put that as a parameter somewhere.
    PlayerVoteState::insert_with_end_timer(
        ctx,
        PlayerVoteType::SubmitEmpire,
        actor_id,
        vec![actor_id, target_emperor.entity_id],
        true,
        1.0,
        30.0,
        empire_state.capital_building_entity_id,
        0,
    );

    Ok(())
}

#[spacetimedb::reducer]
#[shared_table_reducer]
pub fn empire_player_join(ctx: &ReducerContext, request: EmpirePlayerJoinRequest) -> Result<(), String> {
    let actor_id = game_state::actor_id(&ctx, true)?;

    if let Some(rank) = ctx.db.empire_player_data_state().entity_id().find(&actor_id) {
        empire_player_leave(
            ctx,
            EmpirePlayerLeaveRequest {
                empire_entity_id: rank.empire_entity_id,
            },
        )?;
    }

    if ctx.db.empire_state().entity_id().find(&request.empire_entity_id).is_none() {
        return Err("This empire does not exist.".into());
    }

    EmpirePlayerDataState::new(ctx, actor_id, request.empire_entity_id, 9 /*Citizen*/)?;

    ctx.db.empire_player_log_state().try_insert(EmpirePlayerLogState {
        entity_id: actor_id,
        empire_entity_id: request.empire_entity_id,
        last_viewed: 0,
    })?;

    // New Member Notification
    let player_name = ctx.db.player_username_state().entity_id().find(&actor_id).unwrap().username;
    EmpireNotificationState::new(ctx, EmpireNotificationType::NewMember, request.empire_entity_id, vec![player_name]);

    // The player cannot have made donations to the empire yet, no need to update the nodes

    Ok(())
}

#[spacetimedb::reducer]
#[shared_table_reducer]
pub fn empire_player_leave(ctx: &ReducerContext, request: EmpirePlayerLeaveRequest) -> Result<(), String> {
    let actor_id = game_state::actor_id(&ctx, true)?;

    let rank = unwrap_or_err!(
        ctx.db.empire_player_data_state().entity_id().find(&actor_id),
        "Not a citizen of an empire"
    );
    if rank.empire_entity_id != request.empire_entity_id {
        return Err("Not a citizen of that empire".into());
    }

    if rank.rank == 0 {
        return Err("Emperor cannot leave their empire".into());
    }

    // Before the player leaves the empire, remove his donations from all the empire nodes.
    EmpireSettlementState::update_donations_from_player(ctx, actor_id, true)?;

    EmpirePlayerDataState::delete_shared(ctx, rank, crate::inter_module::InterModuleDestination::AllOtherRegions);
    ctx.db.empire_player_log_state().entity_id().delete(&actor_id);

    // Member Left Notification
    let player_name = ctx.db.player_username_state().entity_id().find(&actor_id).unwrap().username;
    EmpireNotificationState::new(ctx, EmpireNotificationType::MemberLeft, request.empire_entity_id, vec![player_name]);

    let region = unwrap_or_err!(ctx.db.user_region_state().identity().find(ctx.sender), "Region not found").region_id;
    send_inter_module_message(
        ctx,
        crate::messages::inter_module::MessageContentsV3::OnPlayerLeftEmpire(OnPlayerLeftEmpireMsg {
            player_entity_id: actor_id,
            empire_entity_id: request.empire_entity_id,
        }),
        crate::inter_module::InterModuleDestination::Region(region),
    );

    Ok(())
}

#[spacetimedb::reducer]
#[shared_table_reducer]
pub fn empire_leave(ctx: &ReducerContext, request: EmpireLeaveRequest) -> Result<(), String> {
    let actor_id = game_state::actor_id(&ctx, true)?;

    if ctx
        .db
        .empire_state()
        .capital_building_entity_id()
        .find(&request.building_entity_id)
        .is_some()
    {
        return Err("The capital of an empire can't leave it".into());
    }

    let claim = unwrap_or_err!(
        ctx.db.claim_state().owner_building_entity_id().find(&request.building_entity_id),
        "This is not a claim building"
    );
    if claim.owner_player_entity_id != actor_id {
        return Err("Only the owner of this claim has this permission".into());
    }

    // Find the building empire affiliation
    let settlement = unwrap_or_err!(
        ctx.db
            .empire_settlement_state()
            .building_entity_id()
            .find(&request.building_entity_id),
        "This is not a settlement building"
    );

    settlement.leave_empire(ctx, claim.name);

    Ok(())
}

#[spacetimedb::reducer]
#[shared_table_reducer]
pub fn empire_dismantle(ctx: &ReducerContext, request: EmpireDismantleRequest) -> Result<(), String> {
    let actor_id = game_state::actor_id(&ctx, true)?;

    // Find the building empire affiliation

    let empire = unwrap_or_err!(
        ctx.db.empire_state().capital_building_entity_id().find(&request.building_entity_id),
        "You can only dismantle an Empire from its capital"
    );

    if !EmpirePlayerDataState::is_emperor(ctx, actor_id, empire.entity_id) {
        return Err("Only the emperor can dismantle their empire".into());
    }

    empire.delete(ctx);
    Ok(())
}

#[spacetimedb::reducer]
#[shared_table_reducer]
pub fn empire_mark_for_expansion(ctx: &ReducerContext, request: EmpireMarkForExpansionRequest) -> Result<(), String> {
    let actor_id = game_state::actor_id(&ctx, true)?;

    if !EmpirePlayerDataState::has_permission(ctx, actor_id, EmpirePermission::MarkAreaForExpansion) {
        return Err("You don't have the permissions to plan the empire expansion".into());
    }

    EmpireNodeState::validate_influence(ctx, request.chunk_index, request.empire_entity_id)?;

    if request.enabled {
        if let Some(mut expansion_state) = ctx.db.empire_expansion_state().chunk_index().find(&request.chunk_index) {
            if !expansion_state.empire_entity_id.contains(&request.empire_entity_id) {
                expansion_state.empire_entity_id.push(request.empire_entity_id);
                EmpireExpansionState::update_shared(ctx, expansion_state, crate::inter_module::InterModuleDestination::AllOtherRegions);
            }
        } else {
            let expansion_state = EmpireExpansionState {
                chunk_index: request.chunk_index,
                empire_entity_id: vec![request.empire_entity_id],
            };
            EmpireExpansionState::insert_shared(ctx, expansion_state, crate::inter_module::InterModuleDestination::AllOtherRegions);
        }
    } else {
        if let Some(mut expansion_state) = ctx.db.empire_expansion_state().chunk_index().find(&request.chunk_index) {
            if let Some(pos) = expansion_state
                .empire_entity_id
                .iter()
                .position(|eid| *eid == request.empire_entity_id)
            {
                expansion_state.empire_entity_id.remove(pos);
                if expansion_state.empire_entity_id.len() == 0 {
                    EmpireExpansionState::delete_shared(ctx, expansion_state, crate::inter_module::InterModuleDestination::AllOtherRegions);
                } else {
                    EmpireExpansionState::update_shared(ctx, expansion_state, crate::inter_module::InterModuleDestination::AllOtherRegions);
                }
            }
        }
    }
    Ok(())
}

pub fn create_watchtower(ctx: &ReducerContext, actor_id: u64, building_entity_id: u64, location: SmallHexTile) -> Result<(), String> {
    let empire_entity_id = unwrap_or_err!(
        ctx.db.empire_player_data_state().entity_id().find(&actor_id),
        "You need to be part of an empire"
    )
    .empire_entity_id;

    let chunk_index = TerrainChunkState::chunk_index_from_coords(&location.chunk_coordinates());
    let supplies = ctx.db.parameters_desc_v2().version().find(&0).unwrap().empire_node_starting_energy;

    // Destroy all existing inactive watchtowers in this node
    for existing_node in ctx.db.empire_node_state().chunk_index().filter(chunk_index) {
        if existing_node.active {
            log::error!(
                "Node {:?} is still active but a watchtower was built in the same chunk",
                existing_node
            );
        }
        delete_empire_building(ctx, 0, existing_node.entity_id, false);
    }

    // Watchtower Built (10)
    EmpireNotificationState::new_with_coord(ctx, EmpireNotificationType::WatchtowerBuilt, empire_entity_id, location);

    let mut empire_node = EmpireNodeState::new(building_entity_id, empire_entity_id, location);
    let _ = empire_node.activate(ctx, supplies);
    EmpireNodeState::insert_shared(ctx, empire_node, crate::inter_module::InterModuleDestination::AllOtherRegions);
    EmpireState::update_empire_upkeep(ctx, empire_entity_id);

    // Delete expansion
    if let Some(expansion) = ctx.db.empire_expansion_state().chunk_index().find(&chunk_index) {
        if expansion.empire_entity_id.contains(&empire_entity_id) {
            // A watch tower is built, no one else can build one there now.
            EmpireExpansionState::delete_shared(ctx, expansion, crate::inter_module::InterModuleDestination::AllOtherRegions);
        }
    }

    Ok(())
}

#[spacetimedb::reducer]
#[shared_table_reducer]
pub fn empire_update_permissions(ctx: &ReducerContext, request: EmpireUpdatePermissionsRequest) -> Result<(), String> {
    let actor_id = game_state::actor_id(&ctx, true)?;

    if !EmpirePlayerDataState::is_emperor(ctx, actor_id, request.empire_entity_id) {
        return Err("You don't have the permissions to edit the empire ranks".into());
    }

    let target_rank = request.rank;

    if target_rank == 0 {
        return Err("Cannot edit Emperor rank's permissions".into());
    }

    if !request.permissions[0] {
        return Err("Supply node permission can't be removed.".into());
    }

    let empire_ranks = ctx.db.empire_rank_state().empire_entity_id().filter(request.empire_entity_id);
    let mut rank = unwrap_or_err!(
        empire_ranks.filter(|r| r.rank == target_rank).next(),
        "Empire doesn't have own this rank"
    );
    //DAB Note: Right now you can grant permissions to others that you yourself don't have

    rank.permissions = request.permissions;
    EmpireRankState::update_shared(ctx, rank, crate::inter_module::InterModuleDestination::AllOtherRegions);
    Ok(())
}

#[spacetimedb::reducer]
#[shared_table_reducer]
pub fn empire_set_rank_title(ctx: &ReducerContext, request: EmpireSetRankTitleRequest) -> Result<(), String> {
    let actor_id = game_state::actor_id(&ctx, true)?;

    if !EmpirePlayerDataState::is_emperor(ctx, actor_id, request.empire_entity_id) {
        return Err("You don't have the permissions to edit the empire ranks".into());
    }

    let target_rank = request.rank;

    let empire_ranks = ctx.db.empire_rank_state().empire_entity_id().filter(request.empire_entity_id);
    let mut rank = unwrap_or_err!(
        empire_ranks.filter(|r| r.rank == target_rank).next(),
        "Empire doesn't have own this rank"
    );

    UserModerationState::validate_chat_privileges(ctx, actor_id, "Your naming priveleges have been suspended")?;

    let sanitized_title_name = sanitize_user_inputs(&request.title);
    if let Err(_) = is_user_text_input_valid(&sanitized_title_name, 35, true) {
        return Err("Invalid rank title".into());
    }

    rank.title = sanitized_title_name;
    EmpireRankState::update_shared(ctx, rank, crate::inter_module::InterModuleDestination::AllOtherRegions);
    Ok(())
}

#[spacetimedb::reducer]
#[shared_table_reducer]
pub fn empire_set_player_rank(ctx: &ReducerContext, request: EmpireSetPlayerRankRequest) -> Result<(), String> {
    let actor_id = game_state::actor_id(&ctx, true)?;

    if !EmpirePlayerDataState::has_permission(ctx, actor_id, EmpirePermission::PromoteLesserRanks) {
        return Err("You don't have the permissions to promote someone".into());
    }

    let mut target_rank = request.rank;
    let acting_player_data = unwrap_or_err!(
        ctx.db.empire_player_data_state().entity_id().find(&actor_id),
        "Not part of an empire"
    );

    if acting_player_data.empire_entity_id != request.empire_entity_id {
        return Err("Not part of this empire".into());
    }

    if target_rank <= acting_player_data.rank {
        return Err("Cannot grant a rank equal or above yours".into());
    }

    if target_rank == 0 {
        return Err("Cannot promote to emperor".into());
    }

    let empire_ranks = ctx.db.empire_rank_state().empire_entity_id().filter(request.empire_entity_id);
    if empire_ranks.filter(|r| r.rank == target_rank).next().is_none() {
        return Err("Empire doesn't have own this rank".into());
    }

    let mut player_data = unwrap_or_err!(
        ctx.db.empire_player_data_state().entity_id().find(&request.player_entity_id),
        "Target is not part of an empire"
    );
    if player_data.empire_entity_id != request.empire_entity_id || player_data.empire_entity_id != player_data.empire_entity_id {
        return Err("Not a member of this empire".into());
    }

    if player_data.rank == 0 {
        return Err("Cannot change the leader's rank".into());
    }

    if player_data.rank <= acting_player_data.rank {
        return Err("You can only change a player's rank below yours".into());
    }

    if player_data.rank + target_rank == 17 {
        // You cannot go to citizen to noble or noble to citizen (8/9). They are somewhat similar and only one should print when attempting to change rank.
        return Err("Invalid rank update".into());
    }

    // The non-citizen/non-noble ranks are limited based on empire size
    if target_rank < 8 {
        let mut controlled_chunks = 0;
        for chunk in ctx.db.empire_chunk_state().iter() {
            if !chunk.empire_entity_id.iter().any(|i| *i != player_data.empire_entity_id) {
                controlled_chunks += 1;
            }
        }
        let mut maximum_count = 0;
        for entry in ctx.db.empire_territory_desc().iter() {
            if controlled_chunks <= entry.chunks {
                break;
            }
            maximum_count = entry.ranks[target_rank as usize];
        }
        let current_count = ctx
            .db
            .empire_player_data_state()
            .empire_entity_id()
            .filter(player_data.empire_entity_id)
            .filter(|r| r.rank == target_rank)
            .count();

        if current_count + 1 > maximum_count as usize {
            return Err(format!("Your empire is limited to {{0}} instances of that rank.|~{maximum_count}"));
        }
    }

    // Demoting someone to citizen or noble will set the rank depending on the under-the-hood status of the player
    if target_rank >= 8 {
        target_rank = if player_data.noble.is_some() { 8 } else { 9 };
    }
    player_data.rank = target_rank;
    EmpirePlayerDataState::update_shared(ctx, player_data, crate::inter_module::InterModuleDestination::AllOtherRegions);
    Ok(())
}

#[spacetimedb::reducer]
#[shared_table_reducer]
pub fn empire_transfer_emperorship(ctx: &ReducerContext, target_player_entity_id: u64) -> Result<(), String> {
    let actor_id = game_state::actor_id(&ctx, true)?;

    if target_player_entity_id == actor_id {
        return Err("You can't transfer your title to yourself".into());
    }

    let player_data = unwrap_or_err!(
        ctx.db.empire_player_data_state().entity_id().find(&actor_id),
        "You are not part of an empire"
    );

    if !EmpirePlayerDataState::is_emperor(ctx, actor_id, player_data.empire_entity_id) {
        return Err("Only the emperor can transfer his title".into());
    }

    let target_data = unwrap_or_err!(
        ctx.db.empire_player_data_state().entity_id().find(&target_player_entity_id),
        "This player is not part of your empire"
    );

    let empire_entity_id = target_data.empire_entity_id;
    if empire_entity_id != player_data.empire_entity_id {
        return Err("This player is part of a different empire".into());
    }

    transfer_emperorship(ctx, Some(player_data), target_data);

    Ok(())
}

#[spacetimedb::reducer]
#[shared_table_reducer]
pub fn empire_rename(ctx: &ReducerContext, new_name: String) -> Result<(), String> {
    let actor_id = game_state::actor_id(&ctx, true)?;

    let player_data = unwrap_or_err!(
        ctx.db.empire_player_data_state().entity_id().find(&actor_id),
        "You are not part of an empire"
    );

    if !EmpirePlayerDataState::is_emperor(ctx, actor_id, player_data.empire_entity_id) {
        return Err("You don't have the permissions to rename the empire".into());
    }

    // [MIGRATION WORK-AROUND] Hard-coded value: 1000 shards. This should be a parameter.
    let rename_cost = 1000;

    let mut empire = unwrap_or_err!(
        ctx.db.empire_state().entity_id().find(player_data.empire_entity_id),
        "Empire does not exist"
    );
    if empire.shard_treasury < rename_cost {
        return Err("Not enough Hexite Shards in the treasury".into());
    }

    empire.shard_treasury -= rename_cost;

    // Do not sanitize the name, but validate it.
    // We'd rather have an error for having < and _ characters than trimming them and updating the result for 1000 shards.
    if let Err(_) = is_user_text_input_valid(&new_name, 35, true) {
        return Err("Invalid empire name".into());
    }

    if ctx.db.empire_state().name().find(&new_name).is_some() {
        return Err("An empire with this name already exists".into());
    }

    empire.name = new_name;

    EmpireState::update_shared(ctx, empire, crate::inter_module::InterModuleDestination::AllOtherRegions);

    Ok(())
}

#[spacetimedb::table(name = empire_craft_supplies_timer, scheduled(empire_craft_supplies_scheduled, at = scheduled_at))]
pub struct EmpireCraftSuppliesTimer {
    #[primary_key]
    #[auto_inc]
    pub scheduled_id: u64,
    pub scheduled_at: spacetimedb::ScheduleAt,
    pub foundry_entity_id: u64,
}

#[spacetimedb::reducer]
pub fn empire_craft_supplies_scheduled(ctx: &ReducerContext, timer: EmpireCraftSuppliesTimer) -> Result<(), String> {
    empire_craft_supplies(ctx, timer.foundry_entity_id)
}

#[spacetimedb::reducer]
pub fn empire_craft_supplies(ctx: &ReducerContext, foundry_entity_id: u64) -> Result<(), String> {
    if !has_role(ctx, &ctx.sender, Role::Admin) {
        return Err("Invalid permissions".into());
    }

    let mut foundry = unwrap_or_err!(
        ctx.db.empire_foundry_state().entity_id().find(&foundry_entity_id),
        "This is not an empire foundry"
    );
    foundry.queued -= 1;
    foundry.hexite_capsules += 1;

    if foundry.queued > 0 {
        // Start the craft
        let params = ctx.db.parameters_desc_v2().version().find(&0).unwrap();
        foundry.started = ctx.timestamp;
        ctx.db
            .empire_craft_supplies_timer()
            .try_insert(EmpireCraftSuppliesTimer {
                scheduled_id: 0,
                scheduled_at: now_plus_secs(params.hexite_capsule_craft_time_seconds as u64, ctx.timestamp),
                foundry_entity_id,
            })
            .ok()
            .unwrap();
    }
    ctx.db.empire_foundry_state().entity_id().update(foundry);

    Ok(())
}

#[spacetimedb::reducer]
#[shared_table_reducer]
pub fn empire_mark_for_siege(ctx: &ReducerContext, request: EmpireMarkForSiegeRequest) -> Result<(), String> {
    let actor_id = game_state::actor_id(&ctx, true)?;

    //// for now, make sure we only siege watch towers
    //let building_state = unwrap_or_err!(
    //    ctx.db.building_state().entity_id().find(&request.building_entity_id),
    //    "This building does not exist"
    //);
    //let building_desc = unwrap_or_err!(
    //    ctx.db.building_desc().id().find(&building_state.building_description_id),
    //    "Invalid building"
    //);
    //if !building_desc.has_category(ctx, BuildingCategory::Watchtower) {
    //    return Err("You can only siege watchtowers (for now)".into());
    //}

    let rank = unwrap_or_err!(
        ctx.db.empire_player_data_state().entity_id().find(&actor_id),
        "You are not a member of an empire"
    );

    let node = unwrap_or_err!(
        ctx.db.empire_node_state().entity_id().find(&request.building_entity_id),
        "This building cannot be marked for siege"
    );
    if node.empire_entity_id == rank.empire_entity_id {
        return Err("You cannot mark your own watchtower for siege".into());
    }

    if !EmpirePlayerDataState::has_permission(ctx, actor_id, EmpirePermission::FlagWatchtowerToSiege) {
        return Err("You don't have the permissions to flag this watchtower to siege".into());
    }

    if let Some(siege) = EmpireNodeSiegeState::get(ctx, request.building_entity_id, rank.empire_entity_id) {
        if request.enable_siege {
            return Err("This watchtower is already marked for siege".into());
        } else {
            // This watchtower is no longer marked for siege
            EmpireNodeSiegeState::delete_shared(ctx, siege, crate::inter_module::InterModuleDestination::AllOtherRegions);
            return Ok(());
        }
    } else if !request.enable_siege {
        return Err("This watchtower is not marked for siege".into());
    }

    let entity_id = game_state::create_entity(ctx);
    let siege_node = EmpireNodeSiegeState {
        entity_id,
        building_entity_id: request.building_entity_id,
        empire_entity_id: rank.empire_entity_id,
        energy: 0,
        active: false,
        start_timestamp: None,
    };

    EmpireNodeSiegeState::insert_shared(ctx, siege_node, crate::inter_module::InterModuleDestination::AllOtherRegions);

    // Marked For Siege (2)
    let coord = node.location.into();
    EmpireNotificationState::new_with_nickname_and_coord(
        ctx,
        EmpireNotificationType::MarkedForSiege,
        rank.empire_entity_id,
        request.building_entity_id,
        coord,
    );
    Ok(())
}

#[spacetimedb::reducer]
pub fn empire_set_directive_message(ctx: &ReducerContext, request: EmpireSetDirectiveMessageRequest) -> Result<(), String> {
    let actor_id = game_state::actor_id(&ctx, true)?;

    let player_rank = unwrap_or_err!(
        ctx.db.empire_player_data_state().entity_id().find(&actor_id),
        "Not part of an empire"
    );

    if player_rank.empire_entity_id != request.empire_entity_id {
        return Err("Not part of this empire".into());
    }

    if player_rank.rank != 0 {
        return Err("Not an emperor".into());
    }

    let mut directive = unwrap_or_err!(
        ctx.db.empire_directive_state().entity_id().find(&request.empire_entity_id),
        "Empire no longer exists."
    );

    let timestamp = match request.message.is_empty() {
        true => None,
        false => Some(ctx.timestamp),
    };

    directive.directive_message = request.message;
    directive.directive_message_timestamp = timestamp;

    ctx.db.empire_directive_state().entity_id().update(directive);

    Ok(())
}

#[spacetimedb::reducer]
#[shared_table_reducer]
pub fn empire_donate_shards(ctx: &ReducerContext, request: EmpireDonateShardsRequest) -> Result<(), String> {
    let actor_id = game_state::actor_id(&ctx, true)?;

    let mut player_data = unwrap_or_err!(
        ctx.db.empire_player_data_state().entity_id().find(&actor_id),
        "You are not part of an empire"
    );

    if request.amount <= 0 {
        return Err("You can only donate a positive amount of shards".into());
    }

    let mut vault = unwrap_or_err!(ctx.db.player_shard_state().entity_id().find(&actor_id), "Player has no vault data");
    if vault.shards < request.amount {
        return Err("You don't carry that many shards".into());
    }

    let mut empire_state = unwrap_or_err!(
        ctx.db.empire_state().entity_id().find(&player_data.empire_entity_id),
        "Empire no longer exists."
    );

    vault.shards -= request.amount;

    ctx.db.player_shard_state().entity_id().update(vault);

    empire_state.shard_treasury += request.amount;

    let empire_entity_id = empire_state.entity_id;
    let nobility_threshold = empire_state.nobility_threshold as u32;
    EmpireState::update_shared(ctx, empire_state, crate::inter_module::InterModuleDestination::AllOtherRegions);

    let donator_name = ctx.db.player_username_state().entity_id().find(&actor_id).unwrap().username;
    let mut on_behalf_name = None;
    if let Some(on_behalf) = request.on_behalf_username {
        let on_behalf_state = unwrap_or_err!(ctx.db.player_username_state().username().find(&on_behalf), "Player does not exist");
        on_behalf_name = Some(on_behalf_state.username);
        player_data = unwrap_or_err!(
            ctx.db.empire_player_data_state().entity_id().find(&actor_id),
            "That player is not part of an empire"
        );
        if player_data.empire_entity_id != empire_entity_id {
            return Err("That player is not part of your empire".into());
        }
    }

    player_data.donated_shards += request.amount as u32;

    // Citizens-to-Noble auto-upgrade
    if player_data.donated_shards >= nobility_threshold && player_data.noble.is_none() {
        player_data.noble = Some(ctx.timestamp);
        if player_data.rank == 9 {
            player_data.rank = 8;
        }
    }

    EmpirePlayerDataState::update_shared(ctx, player_data, crate::inter_module::InterModuleDestination::AllOtherRegions);

    if let Some(on_behalf_name) = on_behalf_name {
        // Donation On Behalf Notification (14)
        EmpireNotificationState::new(
            ctx,
            EmpireNotificationType::DonationByProxy,
            empire_entity_id,
            vec![donator_name, format!("{}", request.amount), on_behalf_name],
        );
    } else {
        // Donation Notification (13)
        EmpireNotificationState::new(
            ctx,
            EmpireNotificationType::Donation,
            empire_entity_id,
            vec![donator_name, format!("{}", request.amount)],
        );
    }

    EmpireSettlementState::update_donations_from_player(ctx, actor_id, false)?;

    Ok(())
}

#[spacetimedb::reducer]
#[shared_table_reducer]
pub fn empire_set_nobility_threshold(ctx: &ReducerContext, threshold: i32) -> Result<(), String> {
    let actor_id = game_state::actor_id(&ctx, true)?;

    if threshold <= 0 {
        return Err("Threshold cannot be a null or negative value".into());
    }

    let player_data = unwrap_or_err!(
        ctx.db.empire_player_data_state().entity_id().find(&actor_id),
        "You are not part of an empire"
    );

    if !EmpirePlayerDataState::is_emperor(ctx, actor_id, player_data.empire_entity_id) {
        return Err("Only the emperor can change the nobility threshold".into());
    }

    let mut empire_state = unwrap_or_err!(
        ctx.db.empire_state().entity_id().find(&player_data.empire_entity_id),
        "Empire no longer exists"
    );
    empire_state.nobility_threshold = threshold;
    EmpireState::update_shared(ctx, empire_state, crate::inter_module::InterModuleDestination::AllOtherRegions);

    Ok(())
}

#[spacetimedb::reducer]
pub fn empire_change_emblem(ctx: &ReducerContext, request: EmpireChangeEmblemRequest) -> Result<(), String> {
    let actor_id = game_state::actor_id(&ctx, true)?;

    let mut emblem = unwrap_or_err!(
        ctx.db.empire_emblem_state().entity_id().find(&request.empire_entity_id),
        "Unknown empire"
    );

    if !EmpirePlayerDataState::is_emperor(ctx, actor_id, emblem.entity_id) {
        return Err("Only the emperor can change the empire's emblem".into());
    }

    emblem.icon_id = request.icon_id;
    emblem.shape_id = request.shape_id;
    emblem.color1_id = request.color1_id;
    emblem.color2_id = request.color2_id;

    ctx.db.empire_emblem_state().entity_id().update(emblem);
    Ok(())
}

#[spacetimedb::reducer]
#[shared_table_reducer]
pub fn empire_take_emperorship(ctx: &ReducerContext) -> Result<(), String> {
    let actor_id = game_state::actor_id(&ctx, true)?;

    let target_data = unwrap_or_err!(
        ctx.db.empire_player_data_state().entity_id().find(&actor_id),
        "You are not part of an empire"
    );

    if target_data.rank == 0 {
        return Err("You're already the emperor".into());
    }

    let empire_state = unwrap_or_err!(
        ctx.db.empire_state().entity_id().find(target_data.empire_entity_id),
        "You are part of an empire that does not exist. How is that possible?"
    );

    let claim = unwrap_or_err!(
        ctx.db
            .claim_state()
            .owner_building_entity_id()
            .find(empire_state.capital_building_entity_id),
        "Unknown settlement"
    );

    if claim.owner_player_entity_id != actor_id {
        return Err("You must be the owner of the capital to take emperorship".into());
    }

    let source_data = ctx
        .db
        .empire_player_data_state()
        .empire_entity_id()
        .filter(empire_state.entity_id)
        .find(|x| x.rank == 0);

    transfer_emperorship(ctx, source_data, target_data);

    Ok(())
}

#[spacetimedb::reducer]
#[shared_table_reducer]
pub fn empire_move_capital(ctx: &ReducerContext, target_claim_entity_id: u64) -> Result<(), String> {
    const SHARDS_COSTS: u32 = 1000; // [MIGRATION WORK-AROUND] Hard-coded value: 1000 shards. This should be a parameter.

    let actor_id = game_state::actor_id(&ctx, true)?;
    let empire_player_data_state = unwrap_or_err!(
        ctx.db.empire_player_data_state().entity_id().find(&actor_id),
        "You are not part of an empire"
    );

    if empire_player_data_state.rank != 0 {
        return Err("Only the emperor can make another settlement the capital".into());
    }

    let claim = unwrap_or_err!(ctx.db.claim_state().entity_id().find(target_claim_entity_id), "Unknown settlement");

    if claim.owner_player_entity_id != actor_id {
        return Err("You must be the owner of the new capital".into());
    }

    let empire_settlement_state = unwrap_or_err!(
        ctx.db.empire_settlement_state().claim_entity_id().find(target_claim_entity_id),
        "The new capital must have Empire Infrastructure researched"
    );

    if empire_settlement_state.empire_entity_id != empire_player_data_state.empire_entity_id {
        return Err("The new capital must be aligned to your empire".into());
    }

    let mut empire_state = unwrap_or_err!(
        ctx.db.empire_state().entity_id().find(empire_settlement_state.empire_entity_id),
        "You are part of an empire that does not exist. How is that possible?"
    );

    // cannot relocate unto itself
    let previous_claim_entity_id = unwrap_or_err!(
        ctx.db
            .claim_state()
            .owner_building_entity_id()
            .find(empire_state.capital_building_entity_id),
        "Unknown origin settlement"
    )
    .entity_id;

    if target_claim_entity_id == previous_claim_entity_id {
        return Err("Invalid relocation".into());
    }

    if empire_state.shard_treasury < SHARDS_COSTS {
        return Err("Not enough Hexite Shards in the treasury".into());
    }

    // Delete foundries
    for foundry in ctx
        .db
        .empire_foundry_state()
        .empire_entity_id()
        .filter(empire_settlement_state.empire_entity_id)
    {
        delete_empire_building(ctx, 0, foundry.entity_id, false);
    }

    // Deduct shards and update the capital
    empire_state.shard_treasury -= SHARDS_COSTS;
    empire_state.capital_building_entity_id = claim.owner_building_entity_id;
    EmpireState::update_shared(ctx, empire_state, crate::inter_module::InterModuleDestination::AllOtherRegions);

    // Recalculate upkeep based on the capital's new location
    EmpireState::update_empire_upkeep(ctx, empire_settlement_state.empire_entity_id);

    Ok(())
}

#[spacetimedb::reducer]
#[shared_table_reducer]
pub fn admin_recalculate_empire_upkeeps(ctx: &ReducerContext) -> Result<(), String> {
    if !has_role(ctx, &ctx.sender, Role::Admin) {
        return Err("Invalid permissions".into());
    }

    for empire in ctx.db.empire_state().iter() {
        EmpireState::update_empire_upkeep(ctx, empire.entity_id);
    }
    Ok(())
}

pub fn delete_empire_building(ctx: &ReducerContext, player_entity_id: u64, building_entity_id: u64, block_inter_module_messages: bool) {
    let mut send_region_message = false;

    // delete empire stuff
    if let Some(empire_node) = ctx.db.empire_node_state().entity_id().find(&building_entity_id) {
        let empire_entity_id = empire_node.empire_entity_id;
        let should_recalculate_upkeep = empire_node.active;

        empire_node.delete(ctx);
        // If the node belongs to an empire that still exists, update that empire's upkeep.
        // The node might exist because of Empire Tech without being part of an empire or be the capital that was deleted in the previous call.
        if should_recalculate_upkeep && ctx.db.empire_state().entity_id().find(&empire_entity_id).is_some() {
            EmpireState::update_empire_upkeep(ctx, empire_entity_id);
        }

        send_region_message = true;
    }

    if let Some(settlement) = ctx.db.empire_settlement_state().building_entity_id().find(building_entity_id) {
        EmpireSettlementState::delete_shared(ctx, settlement, crate::inter_module::InterModuleDestination::AllOtherRegions);
        send_region_message = true;
    }

    if ctx.db.empire_foundry_state().entity_id().find(building_entity_id).is_some() {
        ctx.db.empire_foundry_state().entity_id().delete(building_entity_id);
        send_region_message = true;
    }

    if send_region_message && !block_inter_module_messages {
        let region = game_state::region_index_from_entity_id(building_entity_id);
        send_inter_module_message(
            ctx,
            MessageContentsV3::OnEmpireBuildingDeleted(OnEmpireBuildingDeletedMsg {
                player_entity_id,
                building_entity_id,
                ignore_portals: false,
                drop_items: true,
            }),
            crate::inter_module::InterModuleDestination::Region(region),
        );
    }
}

fn transfer_emperorship(ctx: &ReducerContext, source: Option<EmpirePlayerDataState>, mut target: EmpirePlayerDataState) {
    if let Some(mut source) = source {
        let source_entity_id = source.entity_id;

        source.rank = if source.noble.is_some() { 8 } else { 9 };
        EmpirePlayerDataState::update_shared(ctx, source, crate::inter_module::InterModuleDestination::AllOtherRegions);
        EmpireState::remove_crown_status(ctx, source_entity_id);
    }

    let empire_entity_id = target.empire_entity_id;

    target.rank = 0;
    EmpirePlayerDataState::update_shared(ctx, target, crate::inter_module::InterModuleDestination::AllOtherRegions);
    EmpireState::update_crown_status(ctx, empire_entity_id);
}
