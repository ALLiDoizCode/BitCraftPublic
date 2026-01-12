use spacetimedb::{ReducerContext, Table};

use crate::{messages::static_data::TerraformRecipeDesc, terraform_recipe_desc};

impl TerraformRecipeDesc {
    pub fn max_difference(ctx: &ReducerContext) -> i16 {
        ctx.db
            .terraform_recipe_desc()
            .iter()
            .max_by(|a, b| a.difference.cmp(&b.difference))
            .unwrap()
            .difference
    }
}
