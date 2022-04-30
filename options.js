const options = {
    USE_BG_IMG: true, // use the configured background images or colors for levels / always show black background
    USE_DOTS: false, // display dots in empty spaces / display nothing in empty spaces
    OBJ_BG: true, // display black background instead of the configured background in tiles that have a mob/item etc.
    OBJ_IMG: true, // use image instead of text character for player/mobs etc.
    SHOW_MEMORIZED: true, // display areas that you have seen before / display black where you can't see currently
    GRAY_MEMORIZED: true, // areas that can't be seen currently but are displayed because they have been seen before are grayed / not
    TURN_BASED: false, // in-game time only goes when you take action / in-game time goes on its own
    TURN_DELAY: 300, // milliseconds between each turn if not using turn based mode
    CTRL_CLICK_AUTOTRAVEL: true, // clicking normally moves one time in the direction clicked & holding ctrl autotravels to the place clicked / reversed
    INTERRUPT_AUTOTRAVEL_IF_MOBS: true, // interrupt autotravel if any hostile mobs are displayed / not
    TRAVEL_REPEAT_START_DELAY: 100, // milliseconds for the delay before holding a key to move starts repeating
    TRAVEL_REPEAT_DELAY: 70, // milliseconds between each move when holding a moving key
    AUTOTRAVEL_REPEAT_DELAY: 50, // milliseconds between each move when autotraveling
    CONVERT_ORTHOG_INPUTS_TO_DIAG: true, // convert two orthogonal move inputs to the diagonal direction between them
    CONTROLS: {
        ESC: "Escape",
        ENTER: "Enter",
        SHOOT: "f",
        HISTORY: "h",
        INVENTORY: "i",
        MELEE: "r",
        INTERACT: "t",
        PICKUP: ",",
        INSPECT: ";",
        BOTTOM_LEFT: "z",
        BOTTOM: "s",
        BOTTOM_RIGHT: "c",
        LEFT: "a",
        RIGHT: "d",
        TOP_LEFT: "q",
        TOP: "w",
        TOP_RIGHT: "e",
        ACT_BOTTOM_LEFT: "1",
        ACT_BOTTOM: "2",
        ACT_BOTTOM_RIGHT: "3",
        ACT_LEFT: "4",
        ACT_RIGHT: "6",
        ACT_TOP_LEFT: "7",
        ACT_TOP: "8",
        ACT_TOP_RIGHT: "9"
    },
};

export const optionNameMap = {
    USE_BG_IMG: "Show background image",
    USE_DOTS: "Display dots on floor tiles",
    OBJ_BG: "Show black background for objects",
    OBJ_IMG: "Show images for objects instead of symbols",
    SHOW_MEMORIZED: "Show previously seen tiles",
    GRAY_MEMORIZED: "Gray previously seen tiles",
    TURN_BASED: "Use turn based system instead of realtime",
    TURN_DELAY: "Realtime cycles update speed (ms)",
    CTRL_CLICK_AUTOTRAVEL: "Autotravel on ctrl click, travel in direction on normal click (false=flipped)",
    INTERRUPT_AUTOTRAVEL_IF_MOBS: "Interrupt autotravel if a hostile mob is seen",
    TRAVEL_REPEAT_START_DELAY: "Delay before holding direction starts repeating (ms)",
    TRAVEL_REPEAT_DELAY: "Delay between moves when holding direction (ms)",
    AUTOTRAVEL_REPEAT_DELAY: "Delay between autotravel moves (ms)",
    CONVERT_ORTHOG_INPUTS_TO_DIAG: "Convert two orthogonal move inputs to the diagonal direction between them"
};

export const controlNameMap = {
    ESC: "Escape/cancel",
    ENTER: "Enter",
    SHOOT: "Shoot",
    HISTORY: "Show history",
    INVENTORY: "Show inventory",
    MELEE: "Melee",
    INTERACT: "Interact",
    PICKUP: "Pickup",
    INSPECT: "Inspect",
    BOTTOM_LEFT: "Move bottom left",
    BOTTOM: "Move bottom",
    BOTTOM_RIGHT: "Move bottom right",
    LEFT: "Move left",
    RIGHT: "Move right",
    TOP_LEFT: "Move top left",
    TOP: "Move top",
    TOP_RIGHT: "Move top right",
    ACT_BOTTOM_LEFT: "Action bottom left",
    ACT_BOTTOM: "Action bottom",
    ACT_BOTTOM_RIGHT: "Action bottom right",
    ACT_LEFT: "Action left",
    ACT_RIGHT: "Action right",
    ACT_TOP_LEFT: "Action top left",
    ACT_TOP: "Action top",
    ACT_TOP_RIGHT: "Action top right"
};

export default options;
