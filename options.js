const options = {
    USE_BG_IMG: true, // use the configured background images or colors for levels / always show black background
    USE_DOTS: false, // display dots in empty spaces / display nothing in empty spaces
    OBJ_BG: true, // display black background instead of the configured background in tiles that have a mob/item etc.
    SHOW_MEMORIZED: true, // display areas that you have seen before / display black where you can't see currently
    GRAY_MEMORIZED: true, // areas that can't be seen currently but are displayed because they have been seen before are grayed / not
    TURN_BASED: true, // in-game time only goes when you take action / in-game time goes on its own
    TURN_DELAY: 500, // milliseconds between each turn if not using turn based mode
    CTRL_CLICK_AUTOTRAVEL: true, // clicking normally moves one time in the direction clicked & holding ctrl autotravels to the place clicked / reversed
    INTERRUPT_AUTOTRAVEL_IF_MOBS: true, // interrupt autotravel if any hostile mobs are displayed / not
    TRAVEL_REPEAT_START_DELAY: 100, // milliseconds for the delay before holding a key to move starts repeating
    TRAVEL_REPEAT_DELAY: 70, // milliseconds between each move when holding a moving key
    AUTOTRAVEL_REPEAT_DELAY: 50 // milliseconds between each move when autotraveling
};

export default options;
