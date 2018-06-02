function stateExists (pKnownStateNames, pName) {
    return pKnownStateNames.some((pKnownStateName) => pKnownStateName === pName);
}

function initState(pName) {
    return {
        name: pName,
        type: getStateType(pName)
    };
}

const RE2STATE_TYPE = [{
    re: /initial/,
    stateType: "initial"
}, {
    re: /final/,
    stateType: "final"
}, {
    re: /parallel/,
    stateType: "parallel"
}, {
    re: /(deep.*history)|(history.*deep)/,
    stateType: "deephistory"
}, {
    re: /history/,
    stateType: "history"
}, {
    re: /^\^.*/,
    stateType: "choice"
}, {
    re: /^].*/,
    stateType: "forkjoin"
}];

function matches(pName){
    return (pEntry) => pEntry.re.test(pName);
}

function getStateType(pName) {
    return (RE2STATE_TYPE.find(matches(pName)) || {stateType:"regular"}).stateType;
}

function extractUndeclaredStates (pStateMachine, pKnownStateNames) {
    pKnownStateNames = pKnownStateNames
        ? pKnownStateNames
        : getAlreadyDeclaredStates(pStateMachine);

    pStateMachine.states = pStateMachine.states || [];
    const lTransitions = pStateMachine.transitions || [];

    pStateMachine
        .states
        .filter(isComposite)
        .forEach((pState) => {
            pState.statemachine.states =
                extractUndeclaredStates(
                    pState.statemachine,
                    pKnownStateNames
                );
        });

    lTransitions.forEach((pTransition) => {
        if (!stateExists(pKnownStateNames, pTransition.from)) {
            pKnownStateNames.push(pTransition.from);
            pStateMachine.states.push(initState(pTransition.from));
        }
        if (!stateExists(pKnownStateNames, pTransition.to)) {
            pKnownStateNames.push(pTransition.to);
            pStateMachine.states.push(initState(pTransition.to));
        }
    });
    return pStateMachine.states;
}

function joinNotes(pNotes, pThing) {
    if (pNotes && pNotes.length > 0) {
        pThing.note = pNotes;
    }
    return pThing;
}

function stateEqual(pStateOne, pStateTwo) {
    return pStateOne.name === pStateTwo.name;
}

function uniq(pArray, pEqualFn) {
    return pArray
        .reduce(
            (pBag, pMarble) => {
                const lMarbleIndex = pBag.findIndex((pBagItem) => pEqualFn(pBagItem, pMarble));

                if (lMarbleIndex > -1) {
                    pBag[lMarbleIndex] = pMarble; // ensures the _last_ marble we find is in the bag on that position
                    return pBag;
                }
                return pBag.concat(pMarble);

            },
            []
        );
}

function isComposite(pState){
    return Boolean(pState.statemachine);
}

function getAlreadyDeclaredStates(pStateMachine) {
    const lStates = pStateMachine.states || [];

    return lStates
        .filter(isComposite)
        .reduce(
            (pAllStateNames, pThisState) => pAllStateNames.concat(
                getAlreadyDeclaredStates(pThisState.statemachine)
            ),
            lStates.map((pState) => pState.name)
        );
}

function parseTransitionExpression(pString) {
    /* eslint security/detect-unsafe-regex:0 */
    const TRANSITION_EXPRESSION_RE = /([^[/]+)?(\[[^\]]+\])?[^/]*(\/.+)?/;
    const lRetval = {};
    const lMatchResult = pString.match(TRANSITION_EXPRESSION_RE);


    if (lMatchResult){
        if (lMatchResult[1]){
            lRetval.event = lMatchResult[1].trim();
        }
        if (lMatchResult[2]){
            lRetval.cond = lMatchResult[2].substr(1, lMatchResult[2].length - 2).trim();
        }
        if (lMatchResult[3]){
            lRetval.action = lMatchResult[3].substr(1, lMatchResult[3].length - 1).trim();
        }
    }

    return lRetval;
}

function parseStateActivities(pString) {
    const lRetval = {};
    const TRIGGER_RE_AS_A_STRING = "\\s*(entry|exit)\\s*/\\s*([^\\n$]*)(\\n|$)";
    /* eslint security/detect-non-literal-regexp:0 */
    const TRIGGERS_RE = new RegExp(TRIGGER_RE_AS_A_STRING, "g");
    const TRIGGER_RE  = new RegExp(TRIGGER_RE_AS_A_STRING);

    const lTriggers = pString.match(TRIGGERS_RE);

    if (lTriggers) {
        lRetval.triggers = lTriggers.map(
            (pEntry) => {
                const lMatch = pEntry.match(TRIGGER_RE);
                return {
                    "type": lMatch[1],
                    "body": lMatch[2]
                };
            }
        );
    }

    return lRetval;
}

module.exports = {
    initState,
    extractUndeclaredStates,
    joinNotes,
    stateEqual,
    uniq,
    parseTransitionExpression,
    parseStateActivities,

    getStateType
};
