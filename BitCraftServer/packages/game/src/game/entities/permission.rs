use crate::messages::components::Permission;

impl Permission {
    pub fn meets(self, target: Permission) -> bool {
        if (self as i32) < (target as i32) {
            return false;
        }
        self != Permission::OverrideNoAccess
    }
}
