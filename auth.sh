#!/bin/bash
set -e

PROJECT_ID="gv-network-mapper-dev"
LOCATION="us-central1"

usage() {
  echo "Usage: ./auth.sh [--project <project-id>] [--browser | --service-account <path-to-key.json>]"
  echo ""
  echo "  --project ID           Firebase/GCP project id (default: gv-network-mapper-dev)"
  echo "  --browser              Interactive login via browser (default, for local dev)"
  echo "  --service-account KEY  Use a service account key file (for headless/server)"
  exit 1
}

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DEFAULT_KEY="$SCRIPT_DIR/keys.json"
MODE=""
SA_KEY=""

firebase_login_and_reauth_if_needed() {
  local login_cmd="$1"
  local output
  set +e
  output="$($login_cmd 2>&1)"
  local code=$?
  set -e

  if [[ $code -eq 0 ]]; then
    echo "$output"
    return 0
  fi

  if echo "$output" | grep -qi "credentials are no longer valid"; then
    echo "Firebase credentials expired; reauthenticating..."
    firebase login --reauth
    return 0
  fi

  echo "$output"
  return $code
}

ensure_firebase_project_access() {
  local project_id="$1"
  local list_output
  set +e
  list_output="$(firebase projects:list --json 2>&1)"
  local list_code=$?
  set -e
  if [[ $list_code -ne 0 ]]; then
    if echo "$list_output" | grep -qi "credentials are no longer valid"; then
      echo "Firebase credentials expired while listing projects; running reauth..."
      firebase login --reauth
      list_output="$(firebase projects:list --json)"
    else
      echo "$list_output"
      echo ""
      echo "Could not list Firebase projects. If running in CI/headless mode:"
      echo "  firebase login:ci"
      echo "  export FIREBASE_TOKEN=<token>"
      exit 1
    fi
  fi

  if ! echo "$list_output" | grep -q "\"projectId\":\"$project_id\""; then
    echo "Error: Firebase project '$project_id' was not found in your accessible projects."
    echo "Run: firebase projects:list"
    exit 1
  fi
}

while [[ $# -gt 0 ]]; do
  case $1 in
    --project)
      PROJECT_ID="$2"
      if [[ -z "$PROJECT_ID" ]]; then
        echo "Error: --project requires a project id."
        exit 1
      fi
      shift 2
      ;;
    --browser)
      MODE="browser"
      shift
      ;;
    --service-account)
      MODE="service-account"
      SA_KEY="$2"
      if [[ -z "$SA_KEY" ]]; then
        echo "Error: --service-account requires a path to a key file."
        exit 1
      fi
      shift 2
      ;;
    *)
      usage
      ;;
  esac
done

# Default to browser auth unless mode is explicitly provided.
if [[ -z "$MODE" ]]; then
  MODE="browser"
fi

if ! command -v gcloud >/dev/null 2>&1; then
  echo "Error: gcloud CLI is not installed or not in PATH."
  exit 1
fi

if ! command -v firebase >/dev/null 2>&1; then
  echo "Error: firebase CLI is not installed or not in PATH."
  exit 1
fi

echo "Setting active project to $PROJECT_ID..."
gcloud config set project "$PROJECT_ID"

if [[ "$MODE" == "service-account" ]]; then
  echo "Activating service account from $SA_KEY..."
  gcloud auth activate-service-account --key-file="$SA_KEY"
  export GOOGLE_APPLICATION_CREDENTIALS="$SA_KEY"
  echo "Set GOOGLE_APPLICATION_CREDENTIALS=$SA_KEY"
  echo ""
  echo "Add this to your shell profile to persist:"
  echo "  export GOOGLE_APPLICATION_CREDENTIALS=$SA_KEY"
  echo ""
  echo "Note: Firebase CLI auth for service accounts is typically done via CI token."
  echo "If you need Firebase CLI commands in this shell, run:"
  echo "  firebase login"
else
  echo "Authenticating with gcloud via browser..."
  gcloud auth application-default login --project="$PROJECT_ID"
  gcloud auth application-default set-quota-project "$PROJECT_ID"

  echo "Authenticating Firebase CLI via browser..."
  firebase_login_and_reauth_if_needed "firebase login"
fi

echo "Selecting Firebase project: $PROJECT_ID"
ensure_firebase_project_access "$PROJECT_ID"
firebase use "$PROJECT_ID"

echo ""
echo "Done! Active projects:"
echo "gcloud:   $(gcloud config get project)"
echo "firebase: $(firebase use | sed -n 's/^Now using project //p')"