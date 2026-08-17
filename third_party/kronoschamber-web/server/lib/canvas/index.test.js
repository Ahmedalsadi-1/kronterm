import { describe, expect, it } from "bun:test"

import { __canvasCompat } from "./index.js"

const helpers = {
  normalizeOptionalString(value) {
    if (typeof value !== "string") return ""
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : ""
  },
}

describe("canvas action compatibility", () => {
  it("normalizes legacy kebab-case create action payloads", () => {
    const normalized = __canvasCompat.normalizeCanvasActionRequest(
      {
        type: "create-node",
        workspace_id: "ws_1",
        node: {
          type: "browser",
          title: "Legacy browser node",
          x: 10,
          y: 20,
        },
      },
      helpers,
    )

    expect(normalized.action).toBe("createNode")
    expect(normalized.workspaceId).toBe("ws_1")
    expect(normalized.nodeType).toBe("browser")
    expect(normalized.title).toBe("Legacy browser node")
    expect(normalized.x).toBe(10)
    expect(normalized.y).toBe(20)
  })

  it("normalizes actions[] wrapper payloads", () => {
    const normalized = __canvasCompat.normalizeCanvasActionRequest(
      {
        workspaceId: "ws_2",
        actions: [
          {
            type: "update-node",
            node_id: "node_1",
            patch: {
              title: "Renamed node",
            },
          },
        ],
      },
      helpers,
    )

    expect(normalized.action).toBe("updateNode")
    expect(normalized.workspaceId).toBe("ws_2")
    expect(normalized.nodeId).toBe("node_1")
    expect(normalized.patch).toEqual({ title: "Renamed node" })
  })

  it("normalizes nested action object payloads", () => {
    const normalized = __canvasCompat.normalizeCanvasActionRequest(
      {
        action: {
          type: "create-node",
          workspace_id: "ws_3",
          node: {
            type: "terminal",
            title: "Embedded terminal node",
            x: 44,
            y: 55,
          },
        },
      },
      helpers,
    )

    expect(normalized.action).toBe("createNode")
    expect(normalized.workspaceId).toBe("ws_3")
    expect(normalized.nodeType).toBe("terminal")
    expect(normalized.title).toBe("Embedded terminal node")
    expect(normalized.x).toBe(44)
    expect(normalized.y).toBe(55)
  })

  it("attaches machine-readable codes to error payloads", () => {
    const normalized = __canvasCompat.normalizeCanvasErrorBody(400, {
      error: "Unsupported canvas action: unknown",
    })

    expect(normalized.code).toBe("CANVAS_BAD_REQUEST")
    expect(normalized.error).toBe("Unsupported canvas action: unknown")
  })
})
