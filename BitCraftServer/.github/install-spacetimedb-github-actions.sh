#!/usr/bin/env sh

set -u

if command -v curl >/dev/null 2>&1; then
	_downloader=curl
elif command -v wget >/dev/null 2>&1; then
	_downloader=wget
else
	echo "Error: you need to have either 'curl' or 'wget' installed and in your path"
	exit 1
fi

# First make sure all config is valid, we don't want to end up with
# a partial install.

# Detect the OS and arch
_oss="$(uname -s)"
_cpu="$(uname -m)"

case "$_oss" in
	Linux) _oss=linux;;
	Darwin) _oss=darwin;;
	*) err "Error: unsupported operating system: $_oss";;
esac

case "$_cpu" in
	arm64 | aarch64) _cpu=arm64;;
	x86_64 | x86-64 | x64 | amd64) _cpu=amd64;;
	*) err "Error: unsupported CPU architecture: $_cpu";;
esac

_arc="${_oss}-${_cpu}"

# Compute the download file extension type
case "$_oss" in
	linux) _ext=linux;;
	darwin) _ext=macos;;
	*) echo "Invalid OSS: $_oss" && exit 1;;
esac

# We can now install the binary
_download_file="$(mktemp)"
rm -f "$_download_file"
_download_file="${_download_file}.tar.gz"
_extract_dir="$(mktemp -d)"
_url="https://github.com/clockworklabs/SpacetimeDB/releases/latest/download/spacetime.$_arc.tar.gz"
if [ "$_downloader" = curl ] ; then
	echo "Downloading from https://install.spacetimedb.com..."
	curl -L -sSf --progress-bar "$_url" -o "$_download_file"
elif [ "$_downloader" = wget ] ; then
	echo "Downloading from https://install.spacetimedb.com..."
	wget -O - "$_url" > "$_download_file"
fi

echo "Extracting..."
tar xf "$_download_file" -C "$_extract_dir"
rm -f "$_download_file"
_bin_file="$_extract_dir/spacetime"

chmod +x "$_bin_file"

mv -v "$_bin_file" "./spacetime"

ls -la
