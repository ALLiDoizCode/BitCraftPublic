pub const NO_LOCALIZATION_MARKER: &str = "[[NoI18n]]";

pub fn dont_localize(s: String) -> String {
    return format!("{NO_LOCALIZATION_MARKER}{s}");
}

pub fn dont_reformat(s: String) -> String {
    return s;
}
