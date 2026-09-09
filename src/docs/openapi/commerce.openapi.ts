import {
  bearerSecurity,
  errorResponseContent,
  pageLimitParams,
  serviceResponseContent,
  uuidPath,
} from "./helpers";

export const commerceSchemas = {
  CartItemInput: {
    type: "object",
    required: ["productId"],
    properties: {
      productId: { type: "string", format: "uuid" },
      variantId: {
        type: "string",
        format: "uuid",
        nullable: true,
        description:
          "Required for standard products. Custom (MTO) products must omit this and use preferredColor.",
      },
      quantity: { type: "integer", minimum: 1, maximum: 99, default: 1 },
      customUsername: {
        type: "string",
        maxLength: 80,
        description: "For custom products",
      },
      preferredColor: { type: "string", maxLength: 80 },
      instructions: { type: "string", maxLength: 1000 },
      artworkUrl: { type: "string", format: "uri" },
    },
  },
  UpdateCartItemInput: {
    type: "object",
    description: "At least one field required",
    properties: {
      quantity: { type: "integer", minimum: 1, maximum: 99 },
      customUsername: { type: "string", nullable: true, maxLength: 80 },
      preferredColor: { type: "string", nullable: true, maxLength: 80 },
      instructions: { type: "string", nullable: true, maxLength: 1000 },
      artworkUrl: { type: "string", format: "uri", nullable: true },
    },
  },
  CheckoutInput: {
    type: "object",
    required: ["deliveryZone", "shippingAddress"],
    properties: {
      deliveryZone: {
        type: "string",
        enum: ["lagos", "outside_lagos"],
        description:
          "Lagos = free delivery; outside_lagos = flat ₦5,000 (500000 kobo) fee",
      },
      shippingAddress: {
        type: "string",
        minLength: 5,
        maxLength: 500,
        example: "12 Test Street, Lagos",
      },
    },
  },
  BachsWebhookEvent: {
    type: "object",
    required: ["id", "type"],
    description:
      "Bachs webhook envelope. Signature: HMAC-SHA256 of `{timestamp}.{rawBody}` using BACHS_WEBHOOK_SECRET.",
    properties: {
      id: { type: "string", example: "evt_..." },
      type: {
        type: "string",
        enum: ["collection.succeeded", "collection.failed"],
        description: "Other event types are acknowledged and ignored",
      },
      created_at: { type: "string", format: "date-time" },
      data: {
        type: "object",
        properties: {
          checkout_id: { type: "string", example: "chk_..." },
          amount: {
            type: "string",
            description: 'Decimal NGN string, e.g. "5000.00" (= 500000 kobo)',
            example: "5000.00",
          },
          currency: { type: "string", example: "NGN" },
          metadata: {
            type: "object",
            properties: {
              order_id: { type: "string", format: "uuid" },
              payment_id: { type: "string", format: "uuid" },
            },
          },
        },
      },
    },
  },
};

export const commercePaths = {
  "/api/v1/astore/products": {
    get: {
      tags: ["Public — AStore"],
      summary: "List active products",
      description:
        "**Audience: Public.** Shop catalog — active products only. Prices in kobo.",
      parameters: [
        ...pageLimitParams,
        {
          name: "q",
          in: "query",
          schema: { type: "string" },
          description: "Search name or slug",
        },
        {
          name: "type",
          in: "query",
          schema: { $ref: "#/components/schemas/ProductType" },
        },
      ],
      responses: {
        "200": {
          description: "Paginated active products",
          content: serviceResponseContent,
        },
      },
    },
  },

  "/api/v1/astore/products/{idOrSlug}": {
    get: {
      tags: ["Public — AStore"],
      summary: "Get active product by id or slug",
      description: "**Audience: Public.**",
      parameters: [
        {
          name: "idOrSlug",
          in: "path",
          required: true,
          schema: { type: "string" },
          description: "Product UUID or slug",
          example: "smoke-test-tee",
        },
      ],
      responses: {
        "200": {
          description: "Product with active variants",
          content: serviceResponseContent,
        },
        "404": {
          description: "Not found or inactive",
          content: errorResponseContent,
        },
      },
    },
  },

  "/api/v1/cart": {
    get: {
      tags: ["User — Cart"],
      summary: "Get current cart",
      description:
        "**Audience: Authenticated user.** Server-side cart with line prices in kobo.",
      security: bearerSecurity,
      responses: {
        "200": { description: "Cart", content: serviceResponseContent },
        "401": { description: "Unauthenticated", content: errorResponseContent },
      },
    },
    delete: {
      tags: ["User — Cart"],
      summary: "Clear cart",
      description: "**Audience: Authenticated user.**",
      security: bearerSecurity,
      responses: {
        "200": { description: "Cart cleared", content: serviceResponseContent },
        "401": { description: "Unauthenticated", content: errorResponseContent },
      },
    },
  },

  "/api/v1/cart/items": {
    post: {
      tags: ["User — Cart"],
      summary: "Add item to cart",
      description:
        "**Audience: Authenticated user.** Merges quantity if the same product/variant/custom fields already exist.",
      security: bearerSecurity,
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/CartItemInput" },
          },
        },
      },
      responses: {
        "200": {
          description: "Cart updated",
          content: serviceResponseContent,
        },
        "400": { description: "Validation error", content: errorResponseContent },
        "404": {
          description: "Product/variant not found or inactive",
          content: errorResponseContent,
        },
        "401": { description: "Unauthenticated", content: errorResponseContent },
      },
    },
  },

  "/api/v1/cart/items/{itemId}": {
    patch: {
      tags: ["User — Cart"],
      summary: "Update cart line",
      description: "**Audience: Authenticated user.**",
      security: bearerSecurity,
      parameters: [uuidPath("itemId")],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/UpdateCartItemInput" },
          },
        },
      },
      responses: {
        "200": { description: "Cart updated", content: serviceResponseContent },
        "404": {
          description: "Cart item not found",
          content: errorResponseContent,
        },
        "401": { description: "Unauthenticated", content: errorResponseContent },
      },
    },
    delete: {
      tags: ["User — Cart"],
      summary: "Remove cart line",
      description: "**Audience: Authenticated user.**",
      security: bearerSecurity,
      parameters: [uuidPath("itemId")],
      responses: {
        "200": { description: "Item removed", content: serviceResponseContent },
        "404": {
          description: "Cart item not found",
          content: errorResponseContent,
        },
        "401": { description: "Unauthenticated", content: errorResponseContent },
      },
    },
  },

  "/api/v1/orders/checkout": {
    post: {
      tags: ["User — Orders"],
      summary: "Checkout cart",
      description:
        "**Audience: Authenticated user.** Creates order + pending Bachs payment, decrements stock, clears cart. Returns order and `checkoutUrl` when Bachs init succeeds.",
      security: bearerSecurity,
      requestBody: {
        required: false,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/CheckoutInput" },
          },
        },
      },
      responses: {
        "201": {
          description: "Order created (may include checkoutUrl)",
          content: serviceResponseContent,
        },
        "400": {
          description: "Empty cart / validation",
          content: errorResponseContent,
        },
        "409": {
          description: "Insufficient stock",
          content: errorResponseContent,
        },
        "401": { description: "Unauthenticated", content: errorResponseContent },
      },
    },
  },

  "/api/v1/orders": {
    get: {
      tags: ["User — Orders"],
      summary: "List my orders",
      description: "**Audience: Authenticated user.** Own orders only.",
      security: bearerSecurity,
      parameters: [...pageLimitParams],
      responses: {
        "200": {
          description: "Paginated orders",
          content: serviceResponseContent,
        },
        "401": { description: "Unauthenticated", content: errorResponseContent },
      },
    },
  },

  "/api/v1/orders/{id}": {
    get: {
      tags: ["User — Orders"],
      summary: "Get my order by id",
      description: "**Audience: Authenticated user.** Must own the order.",
      security: bearerSecurity,
      parameters: [uuidPath("id")],
      responses: {
        "200": {
          description: "Order with items + payment",
          content: serviceResponseContent,
        },
        "404": { description: "Order not found", content: errorResponseContent },
        "401": { description: "Unauthenticated", content: errorResponseContent },
      },
    },
  },

  "/api/v1/orders/{id}/pay": {
    post: {
      tags: ["User — Orders"],
      summary: "Start / resume Bachs payment",
      description:
        "**Audience: Authenticated user.** Creates a new Bachs checkout session for a pending payment. Requires public HTTPS return URLs (`BACHS_RETURN_BASE_URL`).",
      security: bearerSecurity,
      parameters: [uuidPath("id")],
      responses: {
        "200": {
          description: "Payment session created (includes checkoutUrl)",
          content: serviceResponseContent,
        },
        "404": { description: "Order not found", content: errorResponseContent },
        "409": {
          description: "Payment not pending",
          content: errorResponseContent,
        },
        "502": {
          description: "Bachs API error",
          content: errorResponseContent,
        },
        "401": { description: "Unauthenticated", content: errorResponseContent },
      },
    },
  },

  "/api/v1/payments/webhooks/bach": {
    post: {
      tags: ["Payments — Webhooks"],
      summary: "Bachs payment webhook",
      description:
        "**Audience: Bachs servers (not browsers).** Verifies `X-Bachs-Timestamp` + `X-Bachs-Signature` (HMAC-SHA256 of `{timestamp}.{rawBody}`). On `collection.succeeded` marks payment success; on `collection.failed` marks failed, cancels order, restocks. Idempotent by event id.",
      parameters: [
        {
          name: "X-Bachs-Timestamp",
          in: "header",
          required: true,
          schema: { type: "string", example: "1710000000" },
          description: "Unix seconds; must be within ±5 minutes",
        },
        {
          name: "X-Bachs-Signature",
          in: "header",
          required: true,
          schema: { type: "string" },
          description: "hex HMAC-SHA256",
        },
      ],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/BachsWebhookEvent" },
          },
        },
      },
      responses: {
        "200": {
          description: "Event processed or ignored",
          content: serviceResponseContent,
        },
        "401": {
          description: "Invalid signature",
          content: errorResponseContent,
        },
        "404": {
          description: "Payment not found for event",
          content: errorResponseContent,
        },
        "409": {
          description: "Amount mismatch / cannot fail successful payment",
          content: errorResponseContent,
        },
        "503": {
          description: "BACHS_WEBHOOK_SECRET not configured",
          content: errorResponseContent,
        },
      },
    },
  },
};
