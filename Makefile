DIST_ENTRY := $(shell pwd)/dist/index.js

.PHONY: build test dev setup register-claude register-codex register-gemini unregister-claude unregister-codex unregister-gemini

# ---------------------------------------------------------------------------
# Build
# ---------------------------------------------------------------------------

build:
	pnpm install
	pnpm run build

test:
	pnpm test

dev:
	pnpm run dev

setup: build register-claude

# ---------------------------------------------------------------------------
# Shared checks
# ---------------------------------------------------------------------------

define check-build
	@if [ ! -f "$(DIST_ENTRY)" ]; then \
		echo "Error: dist/index.js not found. Run 'make build' first."; \
		exit 1; \
	fi
endef

define warn-no-key
	@if [ -z "$$CLICKUP_API_KEY" ]; then \
		echo "Warning: CLICKUP_API_KEY is not set in your shell environment."; \
		echo "The server will be registered but won't work until you set it."; \
		echo ""; \
		echo "  fish:      set -Ux CLICKUP_API_KEY pk_your_token"; \
		echo "  bash/zsh:  export CLICKUP_API_KEY=pk_your_token"; \
		echo ""; \
	fi
endef

# ---------------------------------------------------------------------------
# Claude Code
# ---------------------------------------------------------------------------

register-claude:
	$(check-build)
	$(warn-no-key)
	claude mcp add clickup -s user -t stdio -e CLICKUP_API_KEY='$${CLICKUP_API_KEY}' -- node $(DIST_ENTRY)
	@echo ""
	@echo "Registered with Claude Code. Restart to activate."

unregister-claude:
	claude mcp remove clickup -s user
	@echo "Removed from Claude Code."

# ---------------------------------------------------------------------------
# OpenAI Codex CLI
# ---------------------------------------------------------------------------

register-codex:
	$(check-build)
	$(warn-no-key)
	codex mcp add clickup --env CLICKUP_API_KEY='$${CLICKUP_API_KEY}' -- node $(DIST_ENTRY)
	@echo ""
	@echo "Registered with Codex CLI. Restart to activate."

unregister-codex:
	codex mcp remove clickup
	@echo "Removed from Codex CLI."

# ---------------------------------------------------------------------------
# Google Gemini CLI
# ---------------------------------------------------------------------------

register-gemini:
	$(check-build)
	$(warn-no-key)
	gemini mcp add -s user -e CLICKUP_API_KEY='$${CLICKUP_API_KEY}' clickup node $(DIST_ENTRY)
	@echo ""
	@echo "Registered with Gemini CLI. Restart to activate."

unregister-gemini:
	gemini mcp remove -s user clickup
	@echo "Removed from Gemini CLI."
