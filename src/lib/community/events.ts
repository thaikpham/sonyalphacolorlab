/**
 * Cross-section signals on a recipe page.
 *
 * The gallery's action tiles and the panels they open live in sibling
 * components with no shared parent state — the page that renders both is a
 * Server Component, so lifting a panel's state up would mean wrapping the whole
 * recipe body in a client boundary for one button.
 *
 * Event names live here rather than being typed out in both places: a
 * mismatched string does not error, it just means nothing happens when the
 * button is pressed.
 */
export const OPEN_PROPOSAL_EVENT = 'colorlab:open-proposal';

/**
 * Reveals the "Tweak with AI" panel, which renders nothing until it is asked
 * for. It used to sit open on every recipe page, so a full AI form was the
 * first thing under the settings table whether or not anyone wanted it.
 */
export const OPEN_TWEAK_EVENT = 'colorlab:open-tweak';
