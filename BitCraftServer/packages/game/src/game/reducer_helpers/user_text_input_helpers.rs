use regex::Regex;

// Sanitize player text input
// https://www.notion.so/clockworklabs/Sanitize-player-text-input-776195ca4b304ca386abf5e56a4ffb45
pub fn is_user_text_input_valid(user_input_source: &String, max_length: usize, allow_alphanumeric_only: bool) -> Result<(), String> {
    // basic trim
    let user_input = user_input_source.trim();

    // check length first for performance reasons
    if user_input.len() == 0 {
        return Err(format!("user_input is empty (user_input.len() == 0)"));
    }

    // check length first for performance reasons
    if user_input.len() > max_length {
        return Err(format!(
            "user_input is longer than expected: max_length: {{0}}, user_input.len(): {{1}}|~{}|~{}",
            max_length,
            user_input.len()
        ));
    }

    // probably will never happen because of trim()
    if user_input.chars().all(char::is_whitespace) {
        return Err(format!("user_input contains white space only : '{{0}}'|~{}", user_input).into());
    }

    // pattern alphanumeric and space
    if allow_alphanumeric_only {
        let regex = Regex::new(r"[^A-Za-zÀ-ÖØ-öø-ÿ0-9 ]").unwrap();
        if regex.is_match(&user_input) {
            return Err(format!("user_input contains non-alphanumeric values : {{0}}|~{}", user_input).into());
        }
    }
    Ok(())
}

// Sample Input -> Sample Output
// a<style=color>b                                            -> ab
// <#ff0000>Text</color>                                      -> Text
// <a href="https://www.google.com">Google</a>                -> Google
// <a href="https://www.google.com">Google</a>                -> Google
// <color=#ff0000>Text</color>                                -> Text
// <a href=https://google.com>Text</a>                        -> Text
// <a href="https://www.google.com">a</a>                     -> a
// <#ff0000>Text</color> is good <#ff0000>Text</color>        -> Text is good Text
// hi < i'm doing som < and > bye                             -> hi  bye
pub fn sanitize_user_inputs(user_input_source: &String) -> String {
    let regex = Regex::new(r"<[^>]*>").unwrap();
    let result = regex.replace_all(&user_input_source, "");

    return result.to_string().trim().to_owned();
}
