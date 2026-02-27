// Story 1.1 Integration Tests for Rust Workspace
//
// These tests verify AC2 (Cargo workspace builds) through automated testing
// rather than just the ATDD shell script checks.

use std::process::Command;

#[test]
fn test_cargo_workspace_structure() {
    // Verify Cargo.toml is a virtual workspace
    let cargo_toml =
        std::fs::read_to_string("../../Cargo.toml").expect("Failed to read root Cargo.toml");

    assert!(cargo_toml.contains("[workspace]"));
    assert!(cargo_toml.contains(r#"members = ["crates/*"]"#));
    assert!(cargo_toml.contains(r#"resolver = "2""#));
}

#[test]
fn test_rustfmt_config_exists() {
    let rustfmt_toml =
        std::fs::read_to_string("../../rustfmt.toml").expect("Failed to read rustfmt.toml");

    assert!(rustfmt_toml.contains(r#"edition = "2021""#));
    assert!(rustfmt_toml.contains("max_width = 100"));
}

#[test]
fn test_cargo_build_succeeds() {
    let output = Command::new("cargo")
        .arg("build")
        .current_dir("../..")
        .output()
        .expect("Failed to run cargo build");

    assert!(
        output.status.success(),
        "cargo build failed: {}",
        String::from_utf8_lossy(&output.stderr)
    );
}

#[test]
fn test_unit_tests_exist() {
    // Verify the main.rs has a test module
    let main_rs = std::fs::read_to_string("src/main.rs").expect("Failed to read main.rs");

    assert!(main_rs.contains("#[cfg(test)]"));
    assert!(main_rs.contains("#[test]"));
}

#[test]
fn test_sigil_tui_binary_exists_after_build() {
    // First ensure it's built
    let build_output = Command::new("cargo")
        .arg("build")
        .current_dir("../..")
        .output()
        .expect("Failed to run cargo build");

    assert!(build_output.status.success());

    // Check binary exists
    let binary_path = std::path::Path::new("../../target/debug/sigil-tui");
    assert!(
        binary_path.exists(),
        "sigil-tui binary not found at {:?}",
        binary_path
    );
}

#[test]
fn test_crate_has_required_dependencies() {
    let cargo_toml =
        std::fs::read_to_string("Cargo.toml").expect("Failed to read crate Cargo.toml");

    // Verify required dependencies from AC2
    assert!(cargo_toml.contains("ratatui"));
    assert!(cargo_toml.contains("crossterm"));
    assert!(cargo_toml.contains("tokio"));
    assert!(cargo_toml.contains("serde"));
    assert!(cargo_toml.contains("serde_json"));
}

#[test]
fn test_main_function_exists() {
    // This test verifies the basic structure compiles and main() exists
    // The actual main() function is tested by the binary existing after build
    let main_rs = std::fs::read_to_string("src/main.rs").expect("Failed to read main.rs");
    assert!(main_rs.contains("fn main()"));
}
