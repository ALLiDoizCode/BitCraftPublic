use bitcraft_macro::shared_table_reducer;
use spacetimedb::{ReducerContext, Table};

use crate::{
    game::handlers::authentication::has_role,
    messages::{
        authentication::{Role, ServerIdentity},
        inter_module::{
            inter_module_message_counter, inter_module_message_errors, inter_module_message_v3, InterModuleMessageCounter,
            InterModuleMessageErrors, InterModuleMessageV3, MessageContentsV3,
        },
    },
};

use super::*;

//Called on destination module
#[spacetimedb::reducer]
#[shared_table_reducer]
pub fn process_inter_module_message(ctx: &ReducerContext, sender: u8, message: InterModuleMessageV3) -> Result<(), String> {
    validate_relay_identity(ctx)?;

    if let Some(mut counter) = ctx.db.inter_module_message_counter().module_id().find(&sender) {
        if counter.last_processed_message_id >= message.id {
            //Message was already processed
            spacetimedb::log::warn!("Inter-module message {} was already processed", message.id);
            if let Some(r) = ctx.db.inter_module_message_errors().id().filter((sender, message.id)).next() {
                return Err(r.error);
            }
            return Ok(());
        }
        counter.last_processed_message_id = message.id;
        ctx.db.inter_module_message_counter().module_id().update(counter);
    } else {
        ctx.db.inter_module_message_counter().insert(InterModuleMessageCounter {
            module_id: sender,
            last_processed_message_id: message.id,
        });
    }

    let r = match message.contents {
        MessageContentsV3::TableUpdate(u) => {
            u.apply_updates(ctx);
            Ok(())
        }

        MessageContentsV3::TransferPlayerRequest(_) => panic!("Global module should never receive TransferPlayerRequest message"),
        MessageContentsV3::TransferPlayerHousingRequest(_) => {
            panic!("Global module should never receive TransferPlayerHousingRequest message")
        }
        MessageContentsV3::PlayerCreateRequest(_) => panic!("Global module should never receive PlayerCreateRequest message"),
        MessageContentsV3::OnPlayerNameSetRequest(_) => panic!("Global module should never receive OnPlayerNameSetRequest message"),
        MessageContentsV3::OnEmpireBuildingDeleted(_) => panic!("Global module should never receive OnEmpireBuildingDeleted message"),
        MessageContentsV3::OnPlayerJoinedEmpire(_) => panic!("Global module should never receive OnPlayerJoinedEmpire message"),
        MessageContentsV3::OnPlayerLeftEmpire(_) => panic!("Global module should never receive OnPlayerLeftEmpire message"),
        MessageContentsV3::RegionDestroySiegeEngine(_) => panic!("Global module should never receive RegionDestroySiegeEngine message"),
        MessageContentsV3::EmpireUpdateEmperorCrown(_) => panic!("Global module should never receive EmpireUpdateEmperorCrown message"),
        MessageContentsV3::EmpireRemoveCrown(_) => panic!("Global module should never receive EmpireRemoveCrown message"),
        MessageContentsV3::SignPlayerOut(_) => panic!("Global module should never receive SignPlayerOut message"),
        MessageContentsV3::AdminBroadcastMessage(_) => panic!("Global module should never receive AdminBroadcastMessage message"),
        MessageContentsV3::PlayerSkipQueue(_) => panic!("Global module should never receive PlayerSkipQueue message"),
        MessageContentsV3::GrantHubItem(_) => panic!("Global module should never receive GrantHubItem message"),
        MessageContentsV3::RecoverDeployable(_) => panic!("Global module should never receive RecoverDeployable message"),
        MessageContentsV3::OnDeployableRecovered(_) => panic!("Global module should never receive OnDeployableRecovered message"),
        MessageContentsV3::ReplaceIdentity(_) => panic!("Global module should never receive ReplaceIdentity message"),

        MessageContentsV3::UserUpdateRegionRequest(r) => user_update_region::process_message_on_destination(ctx, r),
        MessageContentsV3::ClaimCreateEmpireSettlementState(r) => {
            claim_create_empire_settlement_state::process_message_on_destination(ctx, r)
        }
        MessageContentsV3::OnClaimMembersChanged(r) => on_claim_members_changed::process_message_on_destination(ctx, r),
        MessageContentsV3::EmpireCreateBuilding(r) => empire_create_building::process_message_on_destination(ctx, r),
        MessageContentsV3::GlobalDeleteEmpireBuilding(r) => global_delete_empire_building::process_message_on_destination(ctx, r),
        MessageContentsV3::DeleteEmpire(r) => delete_empire::process_message_on_destination(ctx, r),
        MessageContentsV3::EmpireClaimJoin(r) => empire_claim_join::process_message_on_destination(ctx, r),
        MessageContentsV3::EmpireResupplyNode(r) => empire_resupply_node::process_message_on_destination(ctx, r),
        MessageContentsV3::EmpireCollectHexiteCapsule(r) => empire_collect_hexite_capsule::process_message_on_destination(ctx, r),
        MessageContentsV3::EmpireStartSiege(r) => empire_start_siege::process_message_on_destination(ctx, r),
        MessageContentsV3::EmpireSiegeAddSupplies(r) => empire_siege_add_supplies::process_message_on_destination(ctx, r),
        MessageContentsV3::OnRegionPlayerCreated(r) => on_region_player_created::process_message_on_destination(ctx, r),
        MessageContentsV3::EmpireQueueSupplies(r) => empire_queue_supplies::process_message_on_destination(ctx, r),
    };

    if let Err(error) = r.clone() {
        spacetimedb::volatile_nonatomic_schedule_immediate!(save_inter_module_message_error(sender, message.id, error));
    }

    return r;
}

#[spacetimedb::reducer()]
fn save_inter_module_message_error(ctx: &ReducerContext, sender: u8, message_id: u64, error: String) {
    if let Err(_) = ServerIdentity::validate_server_only(ctx) {
        return;
    }
    ctx.db.inter_module_message_errors().insert(InterModuleMessageErrors {
        sender_module_id: sender,
        message_id: message_id,
        error: error,
    });
}

//Called on sender module
#[spacetimedb::reducer]
pub fn on_inter_module_message_processed(ctx: &ReducerContext, id: u64, error: Option<String>) -> Result<(), String> {
    validate_relay_identity(ctx)?;

    if let Some(err) = &error {
        spacetimedb::log::error!("Inter-module reducer {id} returned error: {err}");
    }

    let message = ctx.db.inter_module_message_v3().id().find(id).unwrap();
    match message.contents {
        MessageContentsV3::PlayerCreateRequest(r) => player_create::handle_destination_result_on_sender(ctx, r, error),
        MessageContentsV3::GrantHubItem(r) => grant_hub_item::handle_destination_result_on_sender(ctx, r, error),
        _ => {}
    }

    ctx.db.inter_module_message_v3().id().delete(id);
    return Ok(());
}

fn validate_relay_identity(ctx: &ReducerContext) -> Result<(), String> {
    if !has_role(ctx, &ctx.sender, Role::Admin) {
        return Err("Unauthorized".into());
    }
    return Ok(());
}
