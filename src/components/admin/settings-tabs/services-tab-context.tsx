"use client";

import { createContext, useContext } from "react";

/**
 * Lets the Services tab header's "Add service" button open the catalog's editor.
 * `addRequest` increases on each click. Outside the Settings tab (onboarding) there is no
 * provider, and the catalog shows its own "Add service" button.
 */
export interface ServicesTabBridge {
  addRequest: number;
}

const ServicesTabBridgeContext = createContext<ServicesTabBridge | null>(null);
export const ServicesTabBridgeProvider = ServicesTabBridgeContext.Provider;

export function useServicesTabBridge(): ServicesTabBridge | null {
  return useContext(ServicesTabBridgeContext);
}
