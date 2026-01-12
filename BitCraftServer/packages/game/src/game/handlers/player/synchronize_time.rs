use spacetimedb::ReducerContext;

#[spacetimedb::reducer]
pub fn synchronize_time(_ctx: &ReducerContext, _client_time: f64) -> Result<(), String> {
    Ok(())
}
