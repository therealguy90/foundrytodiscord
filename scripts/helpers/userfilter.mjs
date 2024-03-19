export function isUserMainGM() {
    return game.user === game.users.activeGM;
}

export function isUserMainNonGM() {
    return game.user === game.users.filter(user => user.active && !user.isGM).sort((a, b) => a.name.localeCompare(b.name))[0];
}