}

function getReformatter(){
    switch (game.system.id) {
        case 'pf2e':
            return PF2e_reformatMessage;
            break;
        case 'dnd5e':
            return DnD5e_reformatMessage;
            break;
        default:
            return reformatMessage;
            break;
    }
}