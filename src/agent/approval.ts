let resolver: ((approved: boolean) => void) | null = null;
 
// Called by the agent: returns a Promise that stays pending until approve()/deny().
export function requestApproval(): Promise<boolean> {
    return new Promise((resolve) => {
        resolver = resolve;
    });
}
 
// Called by the TUI when the user presses Y.
export function approve() {
    resolver?.(true);
    resolver = null;
}
 
// Called by the TUI when the user presses N.
export function deny() {
    resolver?.(false);
    resolver = null;
}
