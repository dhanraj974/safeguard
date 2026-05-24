// Shared State
const getContacts = () => JSON.parse(localStorage.getItem('safeGuardContacts')) || [];
const getUserName = () => localStorage.getItem('safeGuardUserName') || 'A SafeGuard User';
const getConfig = () => JSON.parse(localStorage.getItem('safeGuardConfig')) || {
    publicKey:'baz9WRFDI0T6mxRx_',
    serviceId: 'service_e7sgbv7',
    templateId: 'template_czfn8n5'
};
const getTestMode = () => JSON.parse(localStorage.getItem('safeGuardTestMode')) || false;
const getFloatingMode = () => JSON.parse(localStorage.getItem('safeGuardFloatingMode')) || false;

let isEmergencyActive = false;

// Service Worker Registration
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(reg => console.log('Service Worker Registered'))
            .catch(err => console.log('Service Worker Failed', err));
    });
}

// PWA Install Logic
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    const installBtn = document.getElementById('installAppBtn');
    if (installBtn) installBtn.classList.remove('hidden');
});

async function installSafeGuard() {
    if (!deferredPrompt) {
        alert("To install SafeGuard:\n1. Click the browser's 3-dot menu (⋮)\n2. Select 'Install SafeGuard' or 'Add to Home Screen'");
        return;
    }
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
        console.log('User accepted the install prompt');
        const installBtn = document.getElementById('installAppBtn');
        if (installBtn) installBtn.classList.add('hidden');
    }
    deferredPrompt = null;
}

// Floating Widget Logic
function initFloatingWidget() {
    // Handle PWA Shortcut trigger
    if (window.location.search.includes('trigger=true')) {
        localStorage.setItem('triggerOnLoad', 'true');
        // Clean URL
        window.history.replaceState({}, document.title, window.location.pathname);
    }

    if (getFloatingMode()) {
        if (!document.getElementById('floatingSOS')) {
            const btn = document.createElement('div');
            btn.id = 'floatingSOS';
            btn.className = 'floating-sos';
            btn.innerHTML = '<i class="fas fa-bell"></i>';
            btn.onclick = () => {
                // If on another page, go home and trigger
                if (!window.location.pathname.includes('index.html')) {
                    localStorage.setItem('triggerOnLoad', 'true');
                    window.location.href = 'index.html';
                } else {
                    document.getElementById('emergencyBtn').click();
                }
            };
            document.body.appendChild(btn);
        }
    } else {
        const btn = document.getElementById('floatingSOS');
        if (btn) btn.remove();
    }
}

document.addEventListener('DOMContentLoaded', initFloatingWidget);

// Shared Utilities
const simulateDelay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function getLocation() {
    return new Promise((resolve) => {
        if (!navigator.geolocation) return resolve({ url: "Geolocation not supported" });
        const timeoutId = setTimeout(() => resolve({ url: "Location timed out" }), 8000);
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                clearTimeout(timeoutId);
                resolve({ url: `https://www.google.com/maps?q=${pos.coords.latitude},${pos.coords.longitude}` });
            },
            () => {
                clearTimeout(timeoutId);
                resolve({ url: "Location access denied" });
            },
            { enableHighAccuracy: true, timeout: 7000 }
        );
    });
}

// SOS Logic (Shared)
async function triggerEmergency(onActionUpdate, onSuccess) {
    const contacts = getContacts();
    const config = getConfig();
    const isTestMode = getTestMode();

    if (isEmergencyActive) return;
    if (contacts.length === 0) {
        alert("CRITICAL: Please add emergency contacts first!");
        window.location.href = 'contacts.html';
        return;
    }

    isEmergencyActive = true;
    onActionUpdate("ACQUIRING GPS COORDINATES...");
    const locationData = await getLocation();
    const senderName = getUserName();

    try {
        const timestamp = new Date().toLocaleString();
        const alertSubject = `🚨 URGENT: EMERGENCY SOS FROM ${senderName.toUpperCase()} 🚨`;
        const alertBody = `
            ATTENTION: This is a REAL EMERGENCY alert from ${senderName} via SafeGuard.
            
            I AM IN IMMEDIATE DANGER AND NEED HELP!
            
            📍 MY LIVE LOCATION: ${locationData.url}
            ⏰ TIME SENT: ${timestamp}
            
            Please take immediate action:
            1. Check my location on the map.
            2. Call me immediately.
            3. Contact emergency services if I don't answer.
            
            This is an automated SOS broadcast for ${senderName}.
        `.trim();

        if (isTestMode) {
            onActionUpdate("SIMULATING ALERTS (TEST MODE)...");
            await simulateDelay(3000);
        } else {
            onActionUpdate("DEPLOYING EMAIL ALERTS...");
            for (const contact of contacts) {
                if (config.publicKey && config.serviceId && config.templateId) {
                    try {
                        await emailjs.send(config.serviceId, config.templateId, {
                            to_email: contact.email,
                            to_name: contact.name,
                            subject: alertSubject,
                            location: locationData.url,
                            message: alertBody,
                            time: timestamp
                        }, config.publicKey);
                    } catch (e) {
                        window.location.href = `mailto:${contact.email}?subject=${encodeURIComponent(alertSubject)}&body=${encodeURIComponent(alertBody)}`;
                    }
                } else {
                    window.location.href = `mailto:${contact.email}?subject=${encodeURIComponent(alertSubject)}&body=${encodeURIComponent(alertBody)}`;
                }
            }

            onActionUpdate("TRIGGERING NATIVE SOS PROTOCOLS...");
            const firstContact = contacts[0];
            if (/Android|iPhone|iPad/i.test(navigator.userAgent)) {
                window.location.href = `tel:${firstContact.phone}`;
                await simulateDelay(2000);
                window.location.href = `sms:${firstContact.phone}?body=${encodeURIComponent(alertBody)}`;
            } else {
                window.location.href = `sms:${firstContact.phone}?body=${encodeURIComponent(alertBody)}`;
            }
        }
        onSuccess(locationData.url);
    } catch (error) {
        console.error("SOS failed:", error);
        onSuccess(locationData.url);
    } finally {
        isEmergencyActive = false;
    }
}
