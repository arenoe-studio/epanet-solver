export const UI_EVENT_OPEN_BUY_TOKEN = "epanet:open-buy-token";

export function openBuyTokenModal() {
  window.dispatchEvent(new Event(UI_EVENT_OPEN_BUY_TOKEN));
}

