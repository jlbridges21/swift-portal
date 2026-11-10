/**
 * Existing Home Screen installs were saved with start URL "/" (the public homepage). Manifest
 * changes don't rewrite that, so this runs inline on the business homepage, before the website
 * paints: in the installed app, the FIRST page of a launch moves to the app entry (/app).
 *
 * Never acts in a normal browser (display-mode check, no user-agent sniffing). sessionStorage is
 * per launch in an installed app, so tapping the business logo later in the same session still
 * shows the website. StandaloneAppBoot marks the session as launched on every other page.
 */
const SCRIPT = `(function(){try{var s=window.matchMedia("(display-mode: standalone)").matches||window.matchMedia("(display-mode: fullscreen)").matches||navigator.standalone===true;if(!s)return;if(sessionStorage.getItem("sp-app-launched"))return;sessionStorage.setItem("sp-app-launched","1");document.documentElement.style.visibility="hidden";var p=location.pathname.replace(/\\/$/,"");location.replace(p+"/app");}catch(e){}})();`;

export const PWA_LAUNCH_SESSION_KEY = "sp-app-launched";

export function StandaloneLaunchRedirect() {
  return <script dangerouslySetInnerHTML={{ __html: SCRIPT }} />;
}
