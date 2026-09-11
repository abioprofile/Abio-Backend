import {
  bearerSecurity,
  errorResponseContent,
  pageLimitParams,
  serviceResponseContent,
  uuidPath,
} from "./helpers";

export const adminSchemas = {
  OrderStatus: {
    type: "string",
    enum: ["processing", "ready", "shipped", "received", "cancelled"],
  },
  PaymentStatus: {
    type: "string",
    enum: ["pending", "success", "failed", "reversed"],
  },
  ProductType: {
    type: "string",
    enum: ["standard", "custom"],
  },
  AdminMe: {
    type: "object",
    properties: {
      id: { type: "string", format: "uuid" },
      email: { type: "string", format: "email" },
      name: { type: "string" },
      active: { type: "boolean" },
      roles: {
        type: "array",
        items: { type: "string", example: "admin" },
      },
    },
  },
  AdminUpdateUserInput: {
    type: "object",
    required: ["active"],
    properties: {
      active: {
        type: "boolean",
        description: "false deactivates the user; true reactivates",
        example: false,
      },
    },
  },
  AdminAssignBadgeInput: {
    type: "object",
    properties: {
      badgeType: {
        type: "string",
        enum: ["verified"],
        default: "verified",
      },
    },
  },
  AdminRevokeBadgeInput: {
    type: "object",
    properties: {
      reason: {
        type: "string",
        maxLength: 500,
        example: "Badge issued in error",
      },
    },
  },
  AdminCreateInviteInput: {
    type: "object",
    required: ["email"],
    properties: {
      email: {
        type: "string",
        format: "email",
        example: "moderator@example.com",
      },
    },
  },
  AdminAcceptInviteInput: {
    type: "object",
    required: ["token"],
    properties: {
      token: {
        type: "string",
        description: "Invite token from create-invite response / email",
        example: "inv_...",
      },
    },
  },
  AStoreVariant: {
    type: "object",
    properties: {
      id: { type: "string", format: "uuid" },
      colorName: { type: "string", example: "Black" },
      colorHex: { type: "string", nullable: true, example: "#000000" },
      imageUrls: {
        type: "array",
        items: { type: "string", format: "uri" },
      },
      stockQty: { type: "integer", example: 10 },
      priceKobo: {
        type: "integer",
        nullable: true,
        description: "Override price in kobo; null uses product basePriceKobo",
        example: 500000,
      },
      active: { type: "boolean" },
      createdAt: { type: "string", format: "date-time" },
      updatedAt: { type: "string", format: "date-time" },
    },
  },
  AStoreProduct: {
    type: "object",
    properties: {
      id: { type: "string", format: "uuid" },
      name: { type: "string", example: "Smoke Test Tee" },
      slug: { type: "string", example: "smoke-test-tee" },
      description: { type: "string", nullable: true },
      active: { type: "boolean" },
      type: { $ref: "#/components/schemas/ProductType" },
      currency: { type: "string", example: "NGN" },
      basePriceKobo: {
        type: "integer",
        description: "Price in kobo (NGN minor units). 500000 = ₦5,000.00",
        example: 500000,
      },
      variants: {
        type: "array",
        items: { $ref: "#/components/schemas/AStoreVariant" },
      },
      createdAt: { type: "string", format: "date-time" },
      updatedAt: { type: "string", format: "date-time" },
    },
  },
  CreateAStoreProductInput: {
    type: "object",
    required: ["name", "type", "basePriceKobo"],
    properties: {
      name: { type: "string", maxLength: 120, example: "Abio Tee" },
      slug: {
        type: "string",
        description: "Optional lowercase kebab-case; auto-generated from name if omitted",
        example: "abio-tee",
      },
      description: { type: "string", maxLength: 2000 },
      type: { $ref: "#/components/schemas/ProductType" },
      currency: {
        type: "string",
        enum: ["NGN"],
        default: "NGN",
        description: "Shop is NGN-only",
      },
      basePriceKobo: { type: "integer", minimum: 0, example: 500000 },
      active: { type: "boolean", default: true },
    },
  },
  UpdateAStoreProductInput: {
    type: "object",
    description: "At least one field required",
    properties: {
      name: { type: "string", maxLength: 120 },
      description: { type: "string", nullable: true, maxLength: 2000 },
      type: { $ref: "#/components/schemas/ProductType" },
      currency: {
        type: "string",
        enum: ["NGN"],
        description: "Shop is NGN-only",
      },
      basePriceKobo: { type: "integer", minimum: 0 },
      active: {
        type: "boolean",
        description: "false soft-hides the product from the public catalog",
      },
    },
  },
  CreateAStoreVariantInput: {
    type: "object",
    required: ["colorName"],
    properties: {
      colorName: { type: "string", maxLength: 80, example: "Black" },
      colorHex: {
        type: "string",
        pattern: "^#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})$",
        example: "#000000",
      },
      imageUrls: {
        type: "array",
        maxItems: 10,
        items: { type: "string", format: "uri" },
        default: [],
      },
      stockQty: { type: "integer", minimum: 0, default: 0 },
      priceKobo: { type: "integer", minimum: 0, nullable: true },
      active: { type: "boolean" },
    },
  },
  UpdateAStoreVariantInput: {
    type: "object",
    description: "At least one field required",
    properties: {
      colorName: { type: "string", maxLength: 80 },
      colorHex: {
        type: "string",
        nullable: true,
        pattern: "^#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})$",
      },
      imageUrls: {
        type: "array",
        maxItems: 10,
        items: { type: "string", format: "uri" },
      },
      stockQty: { type: "integer", minimum: 0 },
      priceKobo: { type: "integer", minimum: 0, nullable: true },
      active: { type: "boolean" },
    },
  },
  PaymentSummary: {
    type: "object",
    properties: {
      id: { type: "string", format: "uuid" },
      status: { $ref: "#/components/schemas/PaymentStatus" },
      provider: { type: "string", enum: ["bach", "paystack", "opay"] },
      providerRef: { type: "string", nullable: true, example: "chk_..." },
      amountKobo: { type: "integer", example: 500000 },
      currency: { type: "string", example: "NGN" },
      paidAt: { type: "string", format: "date-time", nullable: true },
      failedAt: { type: "string", format: "date-time", nullable: true },
      createdAt: { type: "string", format: "date-time" },
    },
  },
  OrderItem: {
    type: "object",
    properties: {
      id: { type: "string", format: "uuid" },
      productId: { type: "string", format: "uuid" },
      variantId: { type: "string", format: "uuid", nullable: true },
      quantity: { type: "integer" },
      unitPriceKobo: { type: "integer" },
      customUsername: { type: "string", nullable: true },
      preferredColor: { type: "string", nullable: true },
      instructions: { type: "string", nullable: true },
      artworkUrl: { type: "string", nullable: true },
      product: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          name: { type: "string" },
          slug: { type: "string" },
          type: { $ref: "#/components/schemas/ProductType" },
        },
      },
      variant: {
        type: "object",
        nullable: true,
        properties: {
          id: { type: "string", format: "uuid" },
          colorName: { type: "string" },
          colorHex: { type: "string", nullable: true },
          imageUrls: { type: "array", items: { type: "string" } },
        },
      },
    },
  },
  AStoreOrder: {
    type: "object",
    properties: {
      id: { type: "string", format: "uuid" },
      userId: { type: "string", format: "uuid" },
      status: { $ref: "#/components/schemas/OrderStatus" },
      totalAmountKobo: { type: "integer", example: 500000 },
      subtotalKobo: { type: "integer", example: 500000 },
      shippingFeeKobo: {
        type: "integer",
        example: 0,
        description: "0 for Lagos; 500000 (₦5,000) outside Lagos",
      },
      deliveryZone: {
        type: "string",
        enum: ["lagos", "outside_lagos"],
        nullable: true,
      },
      currency: { type: "string", example: "NGN" },
      trackingNumber: { type: "string", nullable: true },
      shippingAddress: { type: "string", nullable: true },
      createdAt: { type: "string", format: "date-time" },
      updatedAt: { type: "string", format: "date-time" },
      user: {
        type: "object",
        description: "Present on admin order responses",
        properties: {
          id: { type: "string", format: "uuid" },
          email: { type: "string", format: "email" },
          name: { type: "string" },
        },
      },
      items: {
        type: "array",
        items: { $ref: "#/components/schemas/OrderItem" },
      },
      payment: {
        allOf: [{ $ref: "#/components/schemas/PaymentSummary" }],
        nullable: true,
      },
    },
  },
  UpdateAStoreOrderInput: {
    type: "object",
    description: "At least one field required",
    properties: {
      status: { $ref: "#/components/schemas/OrderStatus" },
      trackingNumber: {
        type: "string",
        nullable: true,
        maxLength: 120,
        example: "NG-TRACK-001",
      },
    },
  },
  DashboardMetrics: {
    type: "object",
    properties: {
      orders: {
        type: "object",
        properties: {
          total: { type: "integer" },
          byStatus: {
            type: "object",
            properties: {
              processing: { type: "integer" },
              ready: { type: "integer" },
              shipped: { type: "integer" },
              received: { type: "integer" },
              cancelled: { type: "integer" },
            },
          },
        },
      },
      payments: {
        type: "object",
        properties: {
          byStatus: {
            type: "object",
            properties: {
              pending: { type: "integer" },
              success: { type: "integer" },
              failed: { type: "integer" },
              reversed: { type: "integer" },
            },
          },
          revenueKobo: {
            type: "integer",
            description: "Sum of successful payment amounts in kobo",
            example: 500000,
          },
          currency: { type: "string", example: "NGN" },
        },
      },
      catalog: {
        type: "object",
        properties: {
          productsTotal: { type: "integer" },
          productsActive: { type: "integer" },
        },
      },
      users: {
        type: "object",
        properties: {
          total: { type: "integer" },
          active: { type: "integer" },
        },
      },
      recentOrders: {
        type: "array",
        maxItems: 5,
        items: { $ref: "#/components/schemas/AStoreOrder" },
      },
    },
  },
};

export const adminPaths = {
  "/api/v1/admin/me": {
    get: {
      tags: ["Admin — Staff"],
      summary: "Current staff profile",
      description:
        "**Audience: Admin / Moderator.** Returns the authenticated staff user and their roles.",
      security: bearerSecurity,
      responses: {
        "200": {
          description: "Staff profile",
          content: serviceResponseContent,
        },
        "401": { description: "Unauthenticated", content: errorResponseContent },
        "403": {
          description: "Not staff (admin or moderator)",
          content: errorResponseContent,
        },
      },
    },
  },

  "/api/v1/admin/users": {
    get: {
      tags: ["Admin — Users"],
      summary: "List users",
      description:
        "**Audience: Admin / Moderator.** Paginated user directory with optional filters.",
      security: bearerSecurity,
      parameters: [
        ...pageLimitParams,
        {
          name: "q",
          in: "query",
          schema: { type: "string" },
          description: "Search name or email (case-insensitive)",
        },
        {
          name: "active",
          in: "query",
          schema: { type: "string", enum: ["true", "false"] },
        },
        {
          name: "hasBadge",
          in: "query",
          schema: { type: "string", enum: ["true", "false"] },
          description: "Filter users with/without a verification badge",
        },
      ],
      responses: {
        "200": {
          description: "Paginated users",
          content: serviceResponseContent,
        },
        "401": { description: "Unauthenticated", content: errorResponseContent },
        "403": { description: "Not staff", content: errorResponseContent },
      },
    },
  },

  "/api/v1/admin/users/{id}": {
    get: {
      tags: ["Admin — Users"],
      summary: "Get user by id",
      description: "**Audience: Admin / Moderator.**",
      security: bearerSecurity,
      parameters: [uuidPath("id")],
      responses: {
        "200": { description: "User details", content: serviceResponseContent },
        "404": { description: "User not found", content: errorResponseContent },
        "401": { description: "Unauthenticated", content: errorResponseContent },
        "403": { description: "Not staff", content: errorResponseContent },
      },
    },
    patch: {
      tags: ["Admin — Users"],
      summary: "Deactivate or reactivate a user",
      description:
        "**Audience: Admin / Moderator.** Cannot update your own account. Writes an audit log.",
      security: bearerSecurity,
      parameters: [uuidPath("id")],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/AdminUpdateUserInput" },
          },
        },
      },
      responses: {
        "200": { description: "User updated", content: serviceResponseContent },
        "400": {
          description: "Cannot update self / validation error",
          content: errorResponseContent,
        },
        "404": { description: "User not found", content: errorResponseContent },
        "401": { description: "Unauthenticated", content: errorResponseContent },
        "403": { description: "Not staff", content: errorResponseContent },
      },
    },
  },

  "/api/v1/admin/users/{id}/badges": {
    post: {
      tags: ["Admin — Users"],
      summary: "Assign verification badge",
      description:
        "**Audience: Admin / Moderator.** Currently only `verified` is supported (upsert).",
      security: bearerSecurity,
      parameters: [uuidPath("id")],
      requestBody: {
        required: false,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/AdminAssignBadgeInput" },
          },
        },
      },
      responses: {
        "200": {
          description: "Badge assigned",
          content: serviceResponseContent,
        },
        "404": { description: "User not found", content: errorResponseContent },
        "401": { description: "Unauthenticated", content: errorResponseContent },
        "403": { description: "Not staff", content: errorResponseContent },
      },
    },
  },

  "/api/v1/admin/users/{id}/badges/{badgeType}/revoke": {
    post: {
      tags: ["Admin — Users"],
      summary: "Revoke verification badge",
      description: "**Audience: Admin / Moderator.**",
      security: bearerSecurity,
      parameters: [
        uuidPath("id"),
        {
          name: "badgeType",
          in: "path",
          required: true,
          schema: { type: "string", enum: ["verified"] },
        },
      ],
      requestBody: {
        required: false,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/AdminRevokeBadgeInput" },
          },
        },
      },
      responses: {
        "200": { description: "Badge revoked", content: serviceResponseContent },
        "404": { description: "Badge not found", content: errorResponseContent },
        "401": { description: "Unauthenticated", content: errorResponseContent },
        "403": { description: "Not staff", content: errorResponseContent },
      },
    },
  },

  "/api/v1/admin/users/{id}/roles/moderator/revoke": {
    post: {
      tags: ["Admin — Users"],
      summary: "Revoke moderator staff role",
      description:
        "**Audience: Admin only.** Removes the `moderator` role from a user. Does not affect `admin` role. Optional `{ reason }`.",
      security: bearerSecurity,
      parameters: [uuidPath("id")],
      requestBody: {
        required: false,
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                reason: { type: "string", maxLength: 500 },
              },
            },
          },
        },
      },
      responses: {
        "200": {
          description: "Moderator role revoked",
          content: serviceResponseContent,
        },
        "404": { description: "User not found", content: errorResponseContent },
        "409": {
          description: "User is not a moderator",
          content: errorResponseContent,
        },
        "401": { description: "Unauthenticated", content: errorResponseContent },
        "403": {
          description: "Admin role required",
          content: errorResponseContent,
        },
      },
    },
  },

  "/api/v1/admin/invites": {
    post: {
      tags: ["Admin — Invites"],
      summary: "Create moderator invite",
      description:
        "**Audience: Admin only.** Invites an existing user email to become a moderator. Returns a token (email send may be separate).",
      security: bearerSecurity,
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/AdminCreateInviteInput" },
          },
        },
      },
      responses: {
        "201": {
          description: "Invite created",
          content: serviceResponseContent,
        },
        "400": {
          description: "User already staff / validation",
          content: errorResponseContent,
        },
        "401": { description: "Unauthenticated", content: errorResponseContent },
        "403": { description: "Admin role required", content: errorResponseContent },
      },
    },
  },

  "/api/v1/admin/invites/accept": {
    post: {
      tags: ["Admin — Invites"],
      summary: "Accept moderator invite",
      description:
        "**Audience: Authenticated user.** Email on the account must match the invite. Grants `moderator` role.",
      security: bearerSecurity,
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/AdminAcceptInviteInput" },
          },
        },
      },
      responses: {
        "200": {
          description: "Invite accepted",
          content: serviceResponseContent,
        },
        "400": {
          description: "Invalid/expired token or email mismatch",
          content: errorResponseContent,
        },
        "401": { description: "Unauthenticated", content: errorResponseContent },
      },
    },
  },

  "/api/v1/admin/astore/products": {
    get: {
      tags: ["Admin — AStore Catalog"],
      summary: "List products (admin)",
      description:
        "**Audience: Admin / Moderator.** Includes inactive products. Prices are in kobo.",
      security: bearerSecurity,
      parameters: [
        ...pageLimitParams,
        {
          name: "active",
          in: "query",
          schema: { type: "string", enum: ["true", "false"] },
        },
        {
          name: "q",
          in: "query",
          schema: { type: "string" },
          description: "Search name or slug",
        },
      ],
      responses: {
        "200": {
          description: "Paginated products with variants",
          content: serviceResponseContent,
        },
        "401": { description: "Unauthenticated", content: errorResponseContent },
        "403": { description: "Not staff", content: errorResponseContent },
      },
    },
    post: {
      tags: ["Admin — AStore Catalog"],
      summary: "Create product",
      description: "**Audience: Admin / Moderator.**",
      security: bearerSecurity,
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/CreateAStoreProductInput" },
          },
        },
      },
      responses: {
        "201": {
          description: "Product created",
          content: serviceResponseContent,
        },
        "401": { description: "Unauthenticated", content: errorResponseContent },
        "403": { description: "Not staff", content: errorResponseContent },
      },
    },
  },

  "/api/v1/admin/astore/products/{id}": {
    get: {
      tags: ["Admin — AStore Catalog"],
      summary: "Get product by id (admin)",
      description: "**Audience: Admin / Moderator.**",
      security: bearerSecurity,
      parameters: [uuidPath("id")],
      responses: {
        "200": {
          description: "Product with variants",
          content: serviceResponseContent,
        },
        "404": {
          description: "Product not found",
          content: errorResponseContent,
        },
        "401": { description: "Unauthenticated", content: errorResponseContent },
        "403": { description: "Not staff", content: errorResponseContent },
      },
    },
    patch: {
      tags: ["Admin — AStore Catalog"],
      summary: "Update product",
      description:
        "**Audience: Admin / Moderator.** Soft-hide via `active: false`. Audited.",
      security: bearerSecurity,
      parameters: [uuidPath("id")],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/UpdateAStoreProductInput" },
          },
        },
      },
      responses: {
        "200": {
          description: "Product updated",
          content: serviceResponseContent,
        },
        "404": {
          description: "Product not found",
          content: errorResponseContent,
        },
        "401": { description: "Unauthenticated", content: errorResponseContent },
        "403": { description: "Not staff", content: errorResponseContent },
      },
    },
  },

  "/api/v1/admin/astore/products/{id}/variants": {
    post: {
      tags: ["Admin — AStore Catalog"],
      summary: "Add product variant",
      description: "**Audience: Admin / Moderator.**",
      security: bearerSecurity,
      parameters: [uuidPath("id", "Product id")],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/CreateAStoreVariantInput" },
          },
        },
      },
      responses: {
        "201": {
          description: "Variant created",
          content: serviceResponseContent,
        },
        "404": {
          description: "Product not found",
          content: errorResponseContent,
        },
        "401": { description: "Unauthenticated", content: errorResponseContent },
        "403": { description: "Not staff", content: errorResponseContent },
      },
    },
  },

  "/api/v1/admin/astore/products/{id}/variants/{variantId}": {
    patch: {
      tags: ["Admin — AStore Catalog"],
      summary: "Update product variant",
      description: "**Audience: Admin / Moderator.**",
      security: bearerSecurity,
      parameters: [
        uuidPath("id", "Product id"),
        uuidPath("variantId", "Variant id"),
      ],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/UpdateAStoreVariantInput" },
          },
        },
      },
      responses: {
        "200": {
          description: "Variant updated",
          content: serviceResponseContent,
        },
        "404": {
          description: "Product or variant not found",
          content: errorResponseContent,
        },
        "401": { description: "Unauthenticated", content: errorResponseContent },
        "403": { description: "Not staff", content: errorResponseContent },
      },
    },
  },

  "/api/v1/admin/astore/orders": {
    get: {
      tags: ["Admin — AStore Orders"],
      summary: "List all store orders",
      description:
        "**Audience: Admin / Moderator.** Includes buyer + payment + line items.",
      security: bearerSecurity,
      parameters: [
        ...pageLimitParams,
        {
          name: "status",
          in: "query",
          schema: { $ref: "#/components/schemas/OrderStatus" },
        },
        {
          name: "paymentStatus",
          in: "query",
          schema: { $ref: "#/components/schemas/PaymentStatus" },
        },
        {
          name: "q",
          in: "query",
          schema: { type: "string" },
          description: "Search order id, tracking number, buyer email, or name",
        },
      ],
      responses: {
        "200": {
          description: "Paginated orders",
          content: serviceResponseContent,
        },
        "401": { description: "Unauthenticated", content: errorResponseContent },
        "403": { description: "Not staff", content: errorResponseContent },
      },
    },
  },

  "/api/v1/admin/astore/orders/{id}": {
    get: {
      tags: ["Admin — AStore Orders"],
      summary: "Get order by id (admin)",
      description: "**Audience: Admin / Moderator.**",
      security: bearerSecurity,
      parameters: [uuidPath("id")],
      responses: {
        "200": {
          description: "Full order",
          content: {
            "application/json": {
              schema: {
                allOf: [
                  { $ref: "#/components/schemas/ServiceResponse" },
                  {
                    type: "object",
                    properties: {
                      data: { $ref: "#/components/schemas/AStoreOrder" },
                    },
                  },
                ],
              },
            },
          },
        },
        "404": { description: "Order not found", content: errorResponseContent },
        "401": { description: "Unauthenticated", content: errorResponseContent },
        "403": { description: "Not staff", content: errorResponseContent },
      },
    },
    patch: {
      tags: ["Admin — AStore Orders"],
      summary: "Update order status / tracking",
      description:
        "**Audience: Admin / Moderator.** Fulfillment updates. Audited as `astore.order.update`.",
      security: bearerSecurity,
      parameters: [uuidPath("id")],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/UpdateAStoreOrderInput" },
            example: {
              status: "shipped",
              trackingNumber: "NG-TRACK-001",
            },
          },
        },
      },
      responses: {
        "200": { description: "Order updated", content: serviceResponseContent },
        "404": { description: "Order not found", content: errorResponseContent },
        "401": { description: "Unauthenticated", content: errorResponseContent },
        "403": { description: "Not staff", content: errorResponseContent },
      },
    },
  },

  "/api/v1/admin/astore/metrics": {
    get: {
      tags: ["Admin — Dashboard"],
      summary: "Store dashboard metrics",
      description:
        "**Audience: Admin / Moderator.** Order/payment aggregates, catalog + user counts, and the 5 most recent orders. Money fields are kobo.",
      security: bearerSecurity,
      responses: {
        "200": {
          description: "Dashboard metrics",
          content: {
            "application/json": {
              schema: {
                allOf: [
                  { $ref: "#/components/schemas/ServiceResponse" },
                  {
                    type: "object",
                    properties: {
                      data: { $ref: "#/components/schemas/DashboardMetrics" },
                    },
                  },
                ],
              },
            },
          },
        },
        "401": { description: "Unauthenticated", content: errorResponseContent },
        "403": { description: "Not staff", content: errorResponseContent },
      },
    },
  },
};
