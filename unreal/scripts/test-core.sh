#!/usr/bin/env bash
set -eu
script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
unreal_dir=$(CDPATH= cd -- "$script_dir/.." && pwd)
test_dir=$(mktemp -d /tmp/shift-left-core.XXXXXX)
trap 'rm -rf "$test_dir"' EXIT
${CXX:-g++} -std=c++17 -Wall -Wextra -Werror -pedantic "$unreal_dir/tests/incident_model_test.cpp" -o "$test_dir/incident-model-tests"
"$test_dir/incident-model-tests"
