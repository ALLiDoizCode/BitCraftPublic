use std::time::Duration;

use bitcraft_macro::shared_table_reducer;
use spacetimedb::{log, ReducerContext, Table, TimeDuration};

use crate::game::game_state::{self, create_entity};
use crate::game::handlers::authentication::has_role;
use crate::inter_module::*;
use crate::messages::action_request::UserModerationCreateUserPolicyRequest;
use crate::messages::authentication::Role;
use crate::messages::components::{UserModerationPolicy, UserModerationState};
use crate::{chat_message_state, user_moderation_state, user_state};

#[spacetimedb::reducer]
#[shared_table_reducer]
fn user_moderation_create(ctx: &ReducerContext, request: UserModerationCreateUserPolicyRequest) -> Result<(), String> {
    if !has_role(ctx, &ctx.sender, Role::Mod) {
        return Err("Unauthorized".into());
    }

    let actor_id = game_state::actor_id(&ctx, false).unwrap_or(0);
    let duration = Duration::from_millis(request.duration_ms);
    let user_moderation = UserModerationState {
        entity_id: create_entity(ctx),
        target_entity_id: request.target_entity_id,
        created_by_entity_id: actor_id,
        user_moderation_policy: request.user_moderation_policy,
        created_time: ctx.timestamp,
        expiration_time: ctx.timestamp + TimeDuration::from(duration),
        duration_ms: request.duration_ms,
    };

    log::info!("[GM] user_moderation_create(): Adding a new instance {:?}", user_moderation);

    let delete_chat_policies = [
        UserModerationPolicy::PermanentBlockLogin,
        UserModerationPolicy::TemporaryBlockLogin,
        UserModerationPolicy::BlockChat,
    ];
    let delete_chat = delete_chat_policies.contains(&request.user_moderation_policy);

    log::info!("[GM] user_moderation_create(): delete_chat : {}", delete_chat);

    if delete_chat {
        let deleted_count = ctx.db.chat_message_state().owner_entity_id().delete(request.target_entity_id);
        log::info!(
            "[GM] user_moderation_create(): Deleted chat messages for user : {}, count : {}",
            &request.target_entity_id,
            deleted_count
        );
    }

    let sign_out_policies = [UserModerationPolicy::PermanentBlockLogin, UserModerationPolicy::TemporaryBlockLogin];

    let sign_out_user = sign_out_policies.contains(&request.user_moderation_policy);

    if sign_out_user {
        log::info!(
            "[GM] user_moderation_create(): Trying to sign out the user ... Looking for the UserState by target_entity_id : {}",
            &request.target_entity_id
        );

        if let Some(user) = ctx.db.user_state().entity_id().find(&request.target_entity_id) {
            sign_player_out::send_message(ctx, user.identity)?;

            log::info!(
                "[GM] user_moderation_create(): Signed out the user by target_entity_id : {}",
                &request.target_entity_id
            );
        }
    }

    UserModerationState::insert_shared(ctx, user_moderation, InterModuleDestination::AllOtherRegions);

    Ok(())
}

#[spacetimedb::reducer]
#[shared_table_reducer]
fn user_moderation_delete(ctx: &ReducerContext, policy_entity_id: u64) -> Result<(), String> {
    if !has_role(ctx, &ctx.sender, Role::Mod) {
        return Err("Unauthorized".into());
    }

    if let Some(policy) = ctx.db.user_moderation_state().entity_id().find(policy_entity_id) {
        UserModerationState::delete_shared(ctx, policy, InterModuleDestination::AllOtherRegions);
    } else {
        return Err("Policy doesn't exist".into());
    }

    Ok(())
}

// This is implemented for debugging purposes
#[spacetimedb::reducer]
fn user_moderation_clear_all(ctx: &ReducerContext, request: UserModerationCreateUserPolicyRequest) -> Result<(), String> {
    if !has_role(ctx, &ctx.sender, Role::Mod) {
        return Err("Unauthorized".into());
    }

    if let Some(existing_state) = ctx.db.user_moderation_state().entity_id().find(&request.target_entity_id) {
        log::info!(
            "[GM] user_moderation_clear_all(): filter_by_entity_id: Found existing_state {:?}",
            existing_state,
        );
    } else {
        log::info!("[GM] user_moderation_clear_all(): filter_by_entity_id: Found no UserModerationState");
    }

    for existing_state in ctx.db.user_moderation_state().target_entity_id().filter(request.target_entity_id) {
        log::info!(
            "[GM] user_moderation_clear_all(): filter_by_target_entity_id: Found existing_state {:?}",
            existing_state,
        );

        UserModerationState::delete_shared(ctx, existing_state, InterModuleDestination::AllOtherRegions);
    }

    Ok(())
}

// This is implemented for debugging purposes
#[spacetimedb::reducer]
fn user_moderation_list_all(ctx: &ReducerContext, request: UserModerationCreateUserPolicyRequest) -> Result<(), String> {
    if !has_role(ctx, &ctx.sender, Role::Mod) {
        return Err("Unauthorized".into());
    }

    for existing_state in ctx.db.user_moderation_state().iter() {
        log::info!("[GM] user_moderation_list_all(): Iterating {:?}", existing_state,);
    }

    if let Some(existing_state) = ctx.db.user_moderation_state().entity_id().find(&request.target_entity_id) {
        log::info!(
            "[GM] user_moderation_list_all(): filter_by_entity_id: With filter {} : Found existing_state {:?}",
            request.target_entity_id,
            existing_state,
        );
    } else {
        log::info!("[GM] user_moderation_list_all(): filter_by_entity_id: Found no UserModerationState");
    }

    for existing_state in ctx.db.user_moderation_state().target_entity_id().filter(request.target_entity_id) {
        log::info!(
            "[GM] user_moderation_list_all(): filter_by_target_entity_id: Found existing_state {:?}",
            existing_state,
        );
    }

    Ok(())
}
