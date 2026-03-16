import { useEffect, useState } from 'react';

// This matches the version in version.json
const CURRENT_VERSION = '1.0.3';

export function useVersionCheck() {
    const [needsUpdate, setNeedsUpdate] = useState(false);

    useEffect(() => {
        // Check every 5 minutes
        const checkVersion = async () => {
            try {
                const response = await fetch('/version.json?t=' + Date.now(), {
                    cache: 'no-store'
                });
                const data = await response.json();

                if (data.version && data.version !== CURRENT_VERSION) {
                    console.log('New version detected:', data.version);
                    setNeedsUpdate(true);
                }
            } catch (err) {
                console.warn('Failed to check version:', err);
            }
        };

        const interval = setInterval(checkVersion, 5 * 60 * 1000);
        checkVersion();

        return () => clearInterval(interval);
    }, []);

    // Deixa o App decidir como avisar o usuário; nada de reload automático
    return { needsUpdate };
}
