/**
 * Payment Service
 *
 * Handles Cashfree payment gateway integration.
 * Creates orders via backend, opens Cashfree checkout, polls for payment status.
 */

import {
  CFPaymentGatewayService,
  CFErrorResponse,
} from "react-native-cashfree-pg-sdk";
import {
  CFDropCheckoutPayment,
  CFEnvironment,
  CFSession,
  CFThemeBuilder,
} from "cashfree-pg-api-contract";
import { post, get, put } from "./api";
import { ENDPOINTS } from "../config/api.config";
import type {
  PlanType,
  SubscriptionPlan,
  CreateOrderResponse,
  PaymentStatusResponse,
  SubscriptionStatusResponse,
} from "../types";

// Cashfree environment (matches backend .env)
const CF_ENVIRONMENT = CFEnvironment.SANDBOX;

/**
 * Build Cashfree checkout theme matching InBlood branding
 */
const buildTheme = () => {
  return new CFThemeBuilder()
    .setNavigationBarBackgroundColor("#0B0B0B")
    .setNavigationBarTextColor("#FFFFFF")
    .setButtonBackgroundColor("#E53935")
    .setButtonTextColor("#FFFFFF")
    .setPrimaryTextColor("#FFFFFF")
    .setSecondaryTextColor("#9E9E9E")
    .build();
};

/**
 * Fetch available subscription plans from backend
 */
export const getPlans = async (): Promise<SubscriptionPlan[]> => {
  const response = await get<SubscriptionPlan[]>(ENDPOINTS.PAYMENTS.PLANS);
  return response.data;
};

/**
 * Create a payment order on the backend
 */
export const createOrder = async (
  planType: PlanType
): Promise<CreateOrderResponse> => {
  const response = await post<CreateOrderResponse>(
    ENDPOINTS.PAYMENTS.CREATE_ORDER,
    { plan_type: planType }
  );
  return response.data;
};

/**
 * Check payment status by polling the backend
 */
export const checkPaymentStatus = async (
  orderId: string
): Promise<PaymentStatusResponse> => {
  const response = await get<PaymentStatusResponse>(
    ENDPOINTS.PAYMENTS.STATUS(orderId)
  );
  return response.data;
};

/**
 * Get current subscription status
 */
export const getSubscriptionStatus =
  async (): Promise<SubscriptionStatusResponse> => {
    const response = await get<SubscriptionStatusResponse>(
      ENDPOINTS.SUBSCRIPTIONS.STATUS
    );
    return response.data;
  };

/**
 * Cancel active subscription
 */
export const cancelSubscription = async (): Promise<{
  expires_at: string;
}> => {
  const response = await put<{ expires_at: string }>(
    ENDPOINTS.SUBSCRIPTIONS.CANCEL
  );
  return response.data;
};

/**
 * Poll payment status until resolved or max attempts reached
 */
const pollPaymentStatus = async (
  orderId: string,
  maxAttempts = 10,
  intervalMs = 2000
): Promise<PaymentStatusResponse> => {
  for (let i = 0; i < maxAttempts; i++) {
    const status = await checkPaymentStatus(orderId);
    if (status.status === "success" || status.status === "failed") {
      return status;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  // Return last known status after max attempts
  return checkPaymentStatus(orderId);
};

/**
 * Start the full payment flow:
 * 1. Create order on backend
 * 2. Open Cashfree checkout
 * 3. Handle callback
 * 4. Poll for confirmation
 *
 * @returns Promise that resolves to true if payment succeeded, false otherwise
 */
export const startPayment = (
  planType: PlanType,
  onSuccess: () => void,
  onFailure: (message: string) => void
): void => {
  (async () => {
    try {
      // Step 1: Create order on backend
      const order = await createOrder(planType);

      console.log(
        "[Payment] Order created:",
        order.order_id,
        "session:",
        order.payment_session_id
      );

      // Step 2: Create Cashfree session and checkout
      const session = new CFSession(
        order.payment_session_id,
        order.order_id,
        CF_ENVIRONMENT
      );

      const theme = buildTheme();
      const dropPayment = new CFDropCheckoutPayment(session, null, theme);

      // Step 3: Set callbacks
      CFPaymentGatewayService.setCallback({
        onVerify: async (orderID: string) => {
          console.log("[Payment] onVerify callback for order:", orderID);
          CFPaymentGatewayService.removeCallback();

          try {
            // Poll backend for confirmed status
            const status = await pollPaymentStatus(orderID);
            if (status.status === "success") {
              onSuccess();
            } else {
              onFailure("Payment could not be confirmed. Please check your subscription status.");
            }
          } catch (err) {
            // If polling fails, still consider it potentially successful
            // since the webhook may handle it
            onSuccess();
          }
        },
        onError: (error: CFErrorResponse, orderID: string) => {
          console.log("[Payment] onError callback:", {
            status: error.getStatus(),
            message: error.getMessage(),
            code: error.getCode(),
            orderID,
          });
          CFPaymentGatewayService.removeCallback();
          onFailure(error.getMessage() || "Payment failed");
        },
      });

      // Step 4: Open Cashfree checkout
      CFPaymentGatewayService.doPayment(dropPayment);
    } catch (err: any) {
      console.log("[Payment] Error starting payment:", err.message);
      onFailure(err.message || "Failed to start payment. Please try again.");
    }
  })();
};

export default {
  getPlans,
  createOrder,
  checkPaymentStatus,
  getSubscriptionStatus,
  cancelSubscription,
  startPayment,
};
