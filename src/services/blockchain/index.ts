/**
 * Blockchain Services
 * MTC Chain integration for loyalty and AI credits
 */

// Types
export * from './types';

// MTC Client
export { MTCClient, getMTCClient, resetMTCClient } from './mtc-client';

// Bridges
export { LoyaltyBridge, getLoyaltyBridge } from './loyalty-bridge';
