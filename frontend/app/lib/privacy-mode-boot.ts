/**
 * The parts of privacy mode the server layout needs (lib/privacy-mode.ts is a
 * client module, whose exports reach a server component as references, not
 * values).
 */
export const PRIVACY_STORAGE_KEY = 'seneca-privacy-mode';

/** Runs in <head> before the page paints; kept tiny and dependency-free. */
export const PRIVACY_BOOT_SCRIPT = `try{if(localStorage.getItem('${PRIVACY_STORAGE_KEY}')==='on')document.documentElement.dataset.privacy='on'}catch(e){}`;
