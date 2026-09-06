import React from 'react';

export type DeviceType = 'desktop' | 'mobile' | 'tablet';

export interface DeviceInfo {
    isMobile: boolean;
    isTablet: boolean;
    isDesktop: boolean;
    deviceType: DeviceType;
    screenWidth: number;
    breakpoint: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
    hasTouchInput: boolean;
}

export const BREAKPOINTS = {
    xs: 0,
    sm: 640,
    md: 768,
    lg: 1024,
    xl: 1280,
    '2xl': 1536,
} as const;

export function getDeviceInfo(): DeviceInfo {
    const width = typeof window !== 'undefined' ? window.innerWidth : 1024;
    return {
        isMobile: false,
        isTablet: false,
        isDesktop: true,
        deviceType: 'desktop',
        screenWidth: width,
        breakpoint: 'lg',
        hasTouchInput: false,
    };
}

export function useDeviceInfo(): DeviceInfo {
    const [deviceInfo, setDeviceInfo] = React.useState<DeviceInfo>(getDeviceInfo);

    React.useEffect(() => {
        if (typeof window === 'undefined') return;
        const handleResize = () => setDeviceInfo(getDeviceInfo());
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    return deviceInfo;
}
