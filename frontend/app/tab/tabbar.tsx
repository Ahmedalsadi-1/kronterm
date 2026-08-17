// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import {
    KronchatProjectsChangedEvent,
    readKronchatProjects,
    requestOpenKronchatProject,
    type KronchatProject,
} from "@/app/aipanel/kronchat-projects";
import { Tooltip } from "@/app/element/tooltip";
import { TabRpcClient } from "@/app/store/wshrpcutil";
import { useWaveEnv } from "@/app/waveenv/waveenv";
import { WorkspaceLayoutModel } from "@/app/workspace/workspace-layout-model";
import { deleteLayoutModelForTab } from "@/layout/lib/layoutModelHooks";
import { isMacOSTahoeOrLater } from "@/util/platformutil";
import { fireAndForget } from "@/util/util";
import { useAtomValue } from "jotai";
import { OverlayScrollbars } from "overlayscrollbars";
import { createRef, memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { debounce } from "throttle-debounce";
import { BrowserTabsBar } from "./browser-tabs-bar";
import { FoldedWidgetsBar } from "./folded-widgets-bar";
import { Tab } from "./tab";
import "./tabbar.scss";
import { TabBarEnv } from "./tabbarenv";
import { UpdateStatusBanner } from "./updatebanner";
import { WorkspaceSwitcher } from "./workspaceswitcher";

const TabDefaultWidth = 130;
const TabMinWidth = 100;
const MacOSTrafficLightsWidth = 74;
const MacOSTahoeTrafficLightsWidth = 80;

const OSOptions = {
    overflow: {
        x: "scroll",
        y: "hidden",
    },
    scrollbars: {
        theme: "os-theme-dark",
        visibility: "auto",
        autoHide: "leave",
        autoHideDelay: 1300,
        autoHideSuspend: false,
        dragScroll: true,
        clickScroll: false,
        pointers: ["mouse", "touch", "pen"],
    },
};

interface TabBarProps {
    workspace: Workspace;
    noTabs?: boolean;
}

const WaveAIButton = memo(({ divRef }: { divRef?: React.RefObject<HTMLDivElement> }) => {
    const env = useWaveEnv<TabBarEnv>();
    const aiPanelOpen = useAtomValue(WorkspaceLayoutModel.getInstance().panelVisibleAtom);
    const hideAiButton = useAtomValue(env.getSettingsKeyAtom("app:hideaibutton"));

    const onClick = () => {
        const currentVisible = WorkspaceLayoutModel.getInstance().getAIPanelVisible();
        WorkspaceLayoutModel.getInstance().setAIPanelVisible(!currentVisible);
    };

    if (hideAiButton) {
        return null;
    }

    return (
        <Tooltip
            content="Toggle KronosCode Panel"
            placement="bottom"
            hideOnClick
            divClassName={`shell-toolbar-button shell-ai-button ${aiPanelOpen ? "is-active text-saturn" : "text-secondary"}`}
            divStyle={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
            divOnClick={onClick}
            divRef={divRef}
        >
            <i className={`fa fa-circle-nodes ${aiPanelOpen ? "text-saturn" : ""}`} />
        </Tooltip>
    );
});
WaveAIButton.displayName = "WaveAIButton";

const KronchatProjectPills = memo(({ projects }: { projects: KronchatProject[] }) => {
    const visibleProjects = projects.slice(0, 3);
    if (!visibleProjects.length) {
        return null;
    }

    const handleOpenProject = (project: KronchatProject) => {
        WorkspaceLayoutModel.getInstance().setAIPanelVisible(true);
        requestOpenKronchatProject(project);
    };

    return (
        <div className="kronchat-project-pills" aria-label="Kronchat projects">
            {visibleProjects.map((project) => (
                <button
                    type="button"
                    key={project.workspace || "focused"}
                    className="kronchat-project-pill"
                    title={`${project.name}${project.workspace ? ` - ${project.workspace}` : ""}`}
                    onClick={() => handleOpenProject(project)}
                >
                    <i className="fa fa-folder-tree" />
                    <span className="kronchat-project-pill-name">{project.name}</span>
                    <span className="kronchat-project-pill-count">{project.sessionCount}</span>
                </button>
            ))}
            {projects.length > visibleProjects.length ? (
                <span className="kronchat-project-pill-more">+{projects.length - visibleProjects.length}</span>
            ) : null}
        </div>
    );
});
KronchatProjectPills.displayName = "KronchatProjectPills";

function strArrayIsEqual(a: string[], b: string[]) {
    // null check
    if (a == null && b == null) {
        return true;
    }
    if (a == null || b == null) {
        return false;
    }
    if (a.length !== b.length) {
        return false;
    }
    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) {
            return false;
        }
    }
    return true;
}

const TabBar = memo(({ workspace, noTabs }: TabBarProps) => {
    const env = useWaveEnv<TabBarEnv>();
    const [tabIds, setTabIds] = useState<string[]>([]);
    const [dragStartPositions, setDragStartPositions] = useState<number[]>([]);
    const [draggingTab, setDraggingTab] = useState<string>();
    const [tabsLoaded, setTabsLoaded] = useState({});
    const [newTabId, setNewTabId] = useState<string | null>(null);

    const tabbarWrapperRef = useRef<HTMLDivElement>(null);
    const tabBarRef = useRef<HTMLDivElement>(null);
    const tabsWrapperRef = useRef<HTMLDivElement>(null);
    const tabRefs = useRef<React.RefObject<HTMLDivElement>[]>([]);
    const addBtnRef = useRef<HTMLButtonElement>(null);
    const draggingRemovedRef = useRef(false);
    const draggingTabDataRef = useRef({
        tabId: "",
        ref: { current: null },
        tabStartX: 0,
        tabStartIndex: 0,
        tabIndex: 0,
        initialOffsetX: null,
        totalScrollOffset: null,
        dragged: false,
    });
    const osInstanceRef = useRef<OverlayScrollbars>(null);
    const draggerLeftRef = useRef<HTMLDivElement>(null);
    const rightContainerRef = useRef<HTMLDivElement>(null);
    const workspaceSwitcherRef = useRef<HTMLDivElement>(null);
    const waveAIButtonRef = useRef<HTMLDivElement>(null);
    const projectPillsRef = useRef<HTMLDivElement>(null);
    const appMenuButtonRef = useRef<HTMLButtonElement>(null);
    const tabWidthRef = useRef<number>(TabDefaultWidth);
    const scrollableRef = useRef<boolean>(false);
    const prevAllLoadedRef = useRef<boolean>(false);
    const resizeFrameRef = useRef<number | null>(null);
    const draggingTabOrderRef = useRef<string[]>([]);
    const activeTabId = useAtomValue(env.atoms.staticTabId);
    const isFullScreen = useAtomValue(env.atoms.isFullScreen);
    const zoomFactor = useAtomValue(env.atoms.zoomFactorAtom);
    const showMenuBar = useAtomValue(env.getSettingsKeyAtom("window:showmenubar"));
    const confirmClose = useAtomValue(env.getSettingsKeyAtom("tab:confirmclose")) ?? false;
    const hideAiButton = useAtomValue(env.getSettingsKeyAtom("app:hideaibutton"));
    const appUpdateStatus = useAtomValue(env.atoms.updaterStatusAtom);
    const [kronchatProjects, setKronchatProjects] = useState<KronchatProject[]>(() => readKronchatProjects());
    const kronchatProjectLayoutKey = useMemo(
        () =>
            kronchatProjects
                .map((project) => `${project.workspace}:${project.name}:${project.sessionCount}:${project.updatedTs}`)
                .join("|"),
        [kronchatProjects]
    );

    let prevDelta: number;
    let prevDragDirection: string;

    // Update refs when tabIds change
    useEffect(() => {
        tabRefs.current = tabIds.map((_, index) => tabRefs.current[index] || createRef());
    }, [tabIds]);

    useEffect(() => {
        if (!workspace) {
            return;
        }
        const newTabIdsArr = workspace.tabids ?? [];

        const areEqual = strArrayIsEqual(tabIds, newTabIdsArr);

        if (!areEqual) {
            setTabIds(newTabIdsArr);
        }
    }, [workspace, tabIds]);

    useEffect(() => {
        const refreshProjects = () => setKronchatProjects(readKronchatProjects());
        const handleProjectsChanged = (event: Event) => {
            const nextProjects = (event as CustomEvent<KronchatProject[]>).detail;
            setKronchatProjects(Array.isArray(nextProjects) ? nextProjects : readKronchatProjects());
        };
        window.addEventListener(KronchatProjectsChangedEvent, handleProjectsChanged);
        window.addEventListener("storage", refreshProjects);
        return () => {
            window.removeEventListener(KronchatProjectsChangedEvent, handleProjectsChanged);
            window.removeEventListener("storage", refreshProjects);
        };
    }, []);

    const saveTabsPosition = useCallback(() => {
        const tabs = tabRefs.current;
        if (tabs === null) return;

        const newStartPositions: number[] = [];
        let cumulativeLeft = 0; // Start from the left edge

        tabRefs.current.forEach((ref) => {
            if (ref.current) {
                newStartPositions.push(cumulativeLeft);
                cumulativeLeft += ref.current.getBoundingClientRect().width; // Add each tab's actual width to the cumulative position
            }
        });

        setDragStartPositions(newStartPositions);
    }, []);

    const setSizeAndPosition = (animate?: boolean) => {
        const tabBar = tabBarRef.current;
        const tabbarWrapper = tabbarWrapperRef.current;
        const draggerLeft = draggerLeftRef.current;
        const addButton = addBtnRef.current;
        if (tabBar === null || tabbarWrapper === null || draggerLeft === null || addButton === null) return;

        const getOuterWidth = (el: HTMLElement): number => {
            const rect = el.getBoundingClientRect();
            const style = getComputedStyle(el);
            return rect.width + parseFloat(style.marginLeft) + parseFloat(style.marginRight);
        };

        const numberOfTabs = tabIds.length;
        if (numberOfTabs === 0) {
            if (osInstanceRef.current) {
                osInstanceRef.current.destroy();
                osInstanceRef.current = null;
            }
            return;
        }

        const tabbarWrapperWidth = tabbarWrapper.getBoundingClientRect().width;
        const windowDragLeftWidth = draggerLeft.getBoundingClientRect().width;
        const rightContainerWidth = rightContainerRef.current?.getBoundingClientRect().width ?? 0;
        const addBtnWidth = getOuterWidth(addButton);
        const appMenuButtonWidth = appMenuButtonRef.current?.getBoundingClientRect().width ?? 0;
        const workspaceSwitcherWidth = workspaceSwitcherRef.current?.getBoundingClientRect().width ?? 0;
        const waveAIButtonWidth = waveAIButtonRef.current != null ? getOuterWidth(waveAIButtonRef.current) : 0;
        const projectPillsWidth = projectPillsRef.current != null ? getOuterWidth(projectPillsRef.current) : 0;

        const nonTabElementsWidth =
            windowDragLeftWidth +
            rightContainerWidth +
            addBtnWidth +
            appMenuButtonWidth +
            workspaceSwitcherWidth +
            waveAIButtonWidth +
            projectPillsWidth;
        const spaceForTabs = tabbarWrapperWidth - nonTabElementsWidth;

        // Compute the ideal width per tab by dividing the available space by the number of tabs
        let idealTabWidth = spaceForTabs / numberOfTabs;

        // Apply min/max constraints
        idealTabWidth = Math.max(TabMinWidth, Math.min(idealTabWidth, TabDefaultWidth));

        // Determine if the tab bar needs to be scrollable
        const newScrollable = idealTabWidth * numberOfTabs > spaceForTabs;

        // Apply the calculated width and position to all tabs
        tabRefs.current.forEach((ref, index) => {
            if (ref.current) {
                if (animate) {
                    ref.current.classList.add("animate");
                } else {
                    ref.current.classList.remove("animate");
                }
                ref.current.style.width = `${idealTabWidth}px`;
                ref.current.style.transform = `translate3d(${index * idealTabWidth}px,0,0)`;
                ref.current.style.opacity = "1";
            }
        });

        // Update the state with the new tab width if it has changed
        if (idealTabWidth !== tabWidthRef.current) {
            tabWidthRef.current = idealTabWidth;
        }

        // Update the state with the new scrollable state if it has changed
        if (newScrollable !== scrollableRef.current) {
            scrollableRef.current = newScrollable;
        }

        // Initialize/destroy overlay scrollbars
        if (newScrollable) {
            if (osInstanceRef.current == null) {
                osInstanceRef.current = OverlayScrollbars(tabBar, { ...(OSOptions as any) });
            } else {
                osInstanceRef.current.update();
            }
        } else {
            if (osInstanceRef.current) {
                osInstanceRef.current.destroy();
                osInstanceRef.current = null;
            }
        }
    };

    const saveTabsPositionDebounced = useCallback(
        debounce(100, () => saveTabsPosition()),
        [saveTabsPosition]
    );

    const handleResizeTabs = useCallback(() => {
        if (resizeFrameRef.current != null) {
            return;
        }
        resizeFrameRef.current = window.requestAnimationFrame(() => {
            resizeFrameRef.current = null;
            setSizeAndPosition();
            saveTabsPositionDebounced();
        });
    }, [tabIds, newTabId, isFullScreen]);

    useEffect(() => {
        return () => {
            if (resizeFrameRef.current != null) {
                window.cancelAnimationFrame(resizeFrameRef.current);
            }
            if (osInstanceRef.current) {
                osInstanceRef.current.destroy();
                osInstanceRef.current = null;
            }
        };
    }, []);

    // update layout on reinit version
    const reinitVersion = useAtomValue(env.atoms.reinitVersion);
    useEffect(() => {
        if (reinitVersion > 0) {
            setSizeAndPosition();
        }
    }, [reinitVersion]);

    // update layout on resize
    useEffect(() => {
        window.addEventListener("resize", handleResizeTabs);
        return () => {
            window.removeEventListener("resize", handleResizeTabs);
        };
    }, [handleResizeTabs]);

    useEffect(() => {
        if (workspaceSwitcherRef.current == null) {
            return;
        }
        const resizeObserver = new ResizeObserver(handleResizeTabs);
        resizeObserver.observe(workspaceSwitcherRef.current);
        return () => resizeObserver.disconnect();
    }, [handleResizeTabs]);

    // update layout on changed tabIds, tabsLoaded, newTabId, hideAiButton, appUpdateStatus, or zoomFactor
    useEffect(() => {
        // Check if all tabs are loaded
        const allLoaded = tabIds.length > 0 && tabIds.every((id) => tabsLoaded[id]);
        if (allLoaded) {
            setSizeAndPosition(newTabId === null && prevAllLoadedRef.current);
            saveTabsPosition();
            if (!prevAllLoadedRef.current) {
                prevAllLoadedRef.current = true;
            }
        }
    }, [
        tabIds,
        tabsLoaded,
        newTabId,
        saveTabsPosition,
        hideAiButton,
        appUpdateStatus,
        zoomFactor,
        showMenuBar,
        kronchatProjectLayoutKey,
    ]);

    const getDragDirection = (currentX: number) => {
        let dragDirection: string;
        if (currentX - prevDelta > 0) {
            dragDirection = "+";
        } else if (currentX - prevDelta === 0) {
            dragDirection = prevDragDirection;
        } else {
            dragDirection = "-";
        }
        prevDelta = currentX;
        prevDragDirection = dragDirection;
        return dragDirection;
    };

    const getNewTabIndex = (currentX: number, tabIndex: number, dragDirection: string) => {
        let newTabIndex = tabIndex;
        const tabWidth = tabWidthRef.current;
        const tabCount = draggingTabOrderRef.current.length || tabIds.length;
        if (dragDirection === "+") {
            // Dragging to the right
            for (let i = tabIndex + 1; i < tabCount; i++) {
                const otherTabStart = dragStartPositions[i];
                if (currentX + tabWidth > otherTabStart + tabWidth / 2) {
                    newTabIndex = i;
                }
            }
        } else {
            // Dragging to the left
            for (let i = tabIndex - 1; i >= 0; i--) {
                const otherTabEnd = dragStartPositions[i] + tabWidth;
                if (currentX < otherTabEnd - tabWidth / 2) {
                    newTabIndex = i;
                }
            }
        }
        return newTabIndex;
    };

    const handleMouseMove = (event: MouseEvent) => {
        const { tabId, ref, tabStartX } = draggingTabDataRef.current;

        let initialOffsetX = draggingTabDataRef.current.initialOffsetX;
        let totalScrollOffset = draggingTabDataRef.current.totalScrollOffset;
        if (initialOffsetX === null) {
            initialOffsetX = event.clientX - tabStartX;
            draggingTabDataRef.current.initialOffsetX = initialOffsetX;
        }
        let currentX = event.clientX - initialOffsetX - totalScrollOffset;
        let tabBarRectWidth = tabBarRef.current.getBoundingClientRect().width;
        // for macos, it's offset to make space for the window buttons
        const tabBarRectLeftOffset = tabBarRef.current.getBoundingClientRect().left;
        const incrementDecrement = tabBarRectLeftOffset * 0.05;
        const dragDirection = getDragDirection(currentX);
        const scrollable = scrollableRef.current;
        const tabWidth = tabWidthRef.current;

        // Scroll the tab bar if the dragged tab overflows the container bounds
        if (scrollable) {
            const { viewport } = osInstanceRef.current.elements();
            const currentScrollLeft = viewport.scrollLeft;

            if (event.clientX <= tabBarRectLeftOffset) {
                viewport.scrollLeft = Math.max(0, currentScrollLeft - incrementDecrement); // Scroll left
                if (viewport.scrollLeft !== currentScrollLeft) {
                    // Only adjust if the scroll actually changed
                    draggingTabDataRef.current.totalScrollOffset += currentScrollLeft - viewport.scrollLeft;
                }
            } else if (event.clientX >= tabBarRectWidth + tabBarRectLeftOffset) {
                viewport.scrollLeft = Math.min(viewport.scrollWidth, currentScrollLeft + incrementDecrement); // Scroll right
                if (viewport.scrollLeft !== currentScrollLeft) {
                    // Only adjust if the scroll actually changed
                    draggingTabDataRef.current.totalScrollOffset -= viewport.scrollLeft - currentScrollLeft;
                }
            }
        }

        // Re-calculate currentX after potential scroll adjustment
        initialOffsetX = draggingTabDataRef.current.initialOffsetX;
        totalScrollOffset = draggingTabDataRef.current.totalScrollOffset;
        currentX = event.clientX - initialOffsetX - totalScrollOffset;

        setDraggingTab((prev) => (prev !== tabId ? tabId : prev));

        // Check if the tab has moved 5 pixels
        if (Math.abs(currentX - tabStartX) >= 50) {
            draggingTabDataRef.current.dragged = true;
        }

        // Constrain movement within the container bounds
        if (tabBarRef.current) {
            const numberOfTabs = tabIds.length;
            const totalDefaultTabWidth = numberOfTabs * TabDefaultWidth;
            if (totalDefaultTabWidth < tabBarRectWidth) {
                // Set to the total default tab width if there's vacant space
                tabBarRectWidth = totalDefaultTabWidth;
            } else if (scrollable) {
                // Set to the scrollable width if the tab bar is scrollable
                tabBarRectWidth = tabsWrapperRef.current.scrollWidth;
            }

            const minLeft = 0;
            const maxRight = tabBarRectWidth - tabWidth;

            // Adjust currentX to stay within bounds
            currentX = Math.min(Math.max(currentX, minLeft), maxRight);
        }

        ref.current!.style.transform = `translate3d(${currentX}px,0,0)`;
        ref.current!.style.zIndex = "100";

        const tabIndex = draggingTabDataRef.current.tabIndex;
        const newTabIndex = getNewTabIndex(currentX, tabIndex, dragDirection);

        if (newTabIndex !== tabIndex) {
            const orderedTabIds = draggingTabOrderRef.current;
            // Remove the dragged tab if not already done
            if (!draggingRemovedRef.current) {
                orderedTabIds.splice(tabIndex, 1);
                draggingRemovedRef.current = true;
            }

            // Find current index of the dragged tab in tempTabs
            const currentIndexOfDraggingTab = orderedTabIds.indexOf(tabId);

            // Move the dragged tab to its new position
            if (currentIndexOfDraggingTab !== -1) {
                orderedTabIds.splice(currentIndexOfDraggingTab, 1);
            }
            orderedTabIds.splice(newTabIndex, 0, tabId);

            // Update visual positions of the tabs
            orderedTabIds.forEach((localTabId, index) => {
                const ref = tabRefs.current.find((ref) => ref.current.dataset.tabId === localTabId);
                if (ref.current && localTabId !== tabId) {
                    ref.current.style.transform = `translate3d(${index * tabWidth}px,0,0)`;
                    ref.current.classList.add("animate");
                }
            });

            draggingTabDataRef.current.tabIndex = newTabIndex;
        }
    };

    const setUpdatedTabsDebounced = useCallback(
        debounce(300, (tabIds: string[]) => {
            // Reset styles
            tabRefs.current.forEach((ref) => {
                ref.current.style.zIndex = "0";
                ref.current.classList.remove("animate");
            });
            // Reset dragging state
            setDraggingTab(null);
            // Update workspace tab ids
            fireAndForget(() => env.rpc.UpdateWorkspaceTabIdsCommand(TabRpcClient, workspace.oid, tabIds));
        }),
        []
    );

    const handleMouseUp = (_event: MouseEvent) => {
        const { tabIndex, dragged } = draggingTabDataRef.current;
        const orderedTabIds = draggingTabOrderRef.current.length ? draggingTabOrderRef.current : tabIds;

        // Update the final position of the dragged tab
        const draggingTab = orderedTabIds[tabIndex];
        const tabWidth = tabWidthRef.current;
        const finalLeftPosition = tabIndex * tabWidth;
        const ref = tabRefs.current.find((ref) => ref.current.dataset.tabId === draggingTab);
        if (ref.current) {
            ref.current.classList.add("animate");
            ref.current.style.transform = `translate3d(${finalLeftPosition}px,0,0)`;
        }

        if (dragged) {
            setUpdatedTabsDebounced([...orderedTabIds]);
        } else {
            // Reset styles
            tabRefs.current.forEach((ref) => {
                ref.current.style.zIndex = "0";
                ref.current.classList.remove("animate");
            });
            // Reset dragging state
            setDraggingTab(null);
        }

        document.removeEventListener("mouseup", handleMouseUp);
        document.removeEventListener("mousemove", handleMouseMove);
        draggingRemovedRef.current = false;
        draggingTabOrderRef.current = [];
    };

    const handleDragStart = useCallback(
        (event: React.MouseEvent<HTMLDivElement, MouseEvent>, tabId: string, ref: React.RefObject<HTMLDivElement>) => {
            if (event.button !== 0) return;

            const tabIndex = tabIds.indexOf(tabId);
            const tabStartX = dragStartPositions[tabIndex]; // Starting X position of the tab

            console.log("handleDragStart", tabId, tabIndex, tabStartX);
            if (ref.current) {
                draggingTabDataRef.current = {
                    tabId: ref.current.dataset.tabId,
                    ref,
                    tabStartX,
                    tabIndex,
                    tabStartIndex: tabIndex,
                    initialOffsetX: null,
                    totalScrollOffset: 0,
                    dragged: false,
                };
                draggingTabOrderRef.current = [...tabIds];

                document.addEventListener("mousemove", handleMouseMove);
                document.addEventListener("mouseup", handleMouseUp);
            }
        },
        [tabIds, dragStartPositions]
    );

    const handleSelectTab = (tabId: string) => {
        if (!draggingTabDataRef.current.dragged) {
            env.electron.setActiveTab(tabId);
        }
    };

    const updateScrollDebounced = useCallback(
        debounce(30, () => {
            if (scrollableRef.current) {
                const { viewport } = osInstanceRef.current.elements();
                viewport.scrollLeft = tabIds.length * tabWidthRef.current;
            }
        }),
        [tabIds]
    );

    const setNewTabIdDebounced = useCallback(
        debounce(100, (tabId: string) => {
            setNewTabId(tabId);
        }),
        []
    );

    const handleAddTab = () => {
        env.electron.createTab();
        tabsWrapperRef.current.style.setProperty("--tabs-wrapper-transition", "width 0.1s ease");

        updateScrollDebounced();

        setNewTabIdDebounced(null);
    };

    const handleCloseTab = (event: React.MouseEvent<HTMLButtonElement, MouseEvent> | null, tabId: string) => {
        event?.stopPropagation();
        env.electron
            .closeTab(workspace.oid, tabId, confirmClose)
            .then((didClose) => {
                if (didClose) {
                    tabsWrapperRef.current?.style.setProperty("--tabs-wrapper-transition", "width 0.3s ease");
                    deleteLayoutModelForTab(tabId);
                }
            })
            .catch((e) => {
                console.log("error closing tab", e);
            });
    };

    const handleTabLoaded = useCallback((tabId: string) => {
        setTabsLoaded((prev) => {
            if (!prev[tabId]) {
                // Only update if the tab isn't already marked as loaded
                return { ...prev, [tabId]: true };
            }
            return prev;
        });
    }, []);

    const activeTabIndex = tabIds.indexOf(activeTabId);

    function onEllipsisClick() {
        env.electron.showWorkspaceAppMenu(workspace.oid);
    }

    const tabsWrapperWidth = tabIds.length * tabWidthRef.current;
    const showAppMenuButton = env.isWindows() || (!env.isMacOS() && !showMenuBar);

    // Calculate window drag left width based on platform and state
    let windowDragLeftWidth = 10;
    if (env.isMacOS() && !isFullScreen) {
        const trafficLightsWidth = isMacOSTahoeOrLater() ? MacOSTahoeTrafficLightsWidth : MacOSTrafficLightsWidth;
        if (zoomFactor > 0) {
            windowDragLeftWidth = trafficLightsWidth / zoomFactor;
        } else {
            windowDragLeftWidth = trafficLightsWidth;
        }
    }

    // Calculate window drag right width
    let windowDragRightWidth = 12;
    if (env.isWindows()) {
        if (zoomFactor > 0) {
            windowDragRightWidth = 139 / zoomFactor;
        } else {
            windowDragRightWidth = 139;
        }
    }

    return (
        <div ref={tabbarWrapperRef} className="tab-bar-wrapper">
            <div
                ref={draggerLeftRef}
                className="h-full shrink-0 z-window-drag"
                style={{ width: windowDragLeftWidth, WebkitAppRegion: "drag" } as any}
            />
            {showAppMenuButton && (
                <button
                    type="button"
                    ref={appMenuButtonRef}
                    className="shell-toolbar-button shell-app-menu-button"
                    style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
                    onClick={onEllipsisClick}
                    aria-label="Open application menu"
                >
                    <i className="fa fa-ellipsis" />
                </button>
            )}
            <WaveAIButton divRef={waveAIButtonRef} />
            <Tooltip
                content="Workspace Switcher"
                placement="bottom"
                hideOnClick
                divRef={workspaceSwitcherRef}
                divClassName="flex items-center"
            >
                <WorkspaceSwitcher showLabel />
            </Tooltip>
            <FoldedWidgetsBar />
            <div ref={projectPillsRef}>
                <KronchatProjectPills projects={kronchatProjects} />
            </div>
            <BrowserTabsBar currentTabId={activeTabId} />
            <div
                className="tab-bar"
                ref={tabBarRef}
                role="tablist"
                aria-label="Workspace tabs"
                data-overlayscrollbars-initialize
            >
                <div
                    className="tabs-wrapper"
                    ref={tabsWrapperRef}
                    style={{
                        width: noTabs ? 0 : tabsWrapperWidth,
                        ...(noTabs ? ({ WebkitAppRegion: "drag" } as React.CSSProperties) : {}),
                    }}
                >
                    {!noTabs &&
                        tabIds.map((tabId, index) => {
                            const isActive = activeTabId === tabId;
                            const showDivider = index !== 0 && !isActive && index !== activeTabIndex + 1;
                            return (
                                <Tab
                                    key={tabId}
                                    ref={tabRefs.current[index]}
                                    id={tabId}
                                    showDivider={showDivider}
                                    onSelect={() => handleSelectTab(tabId)}
                                    active={isActive}
                                    onDragStart={(event) => handleDragStart(event, tabId, tabRefs.current[index])}
                                    onClose={(event) => handleCloseTab(event, tabId)}
                                    onLoaded={() => handleTabLoaded(tabId)}
                                    isDragging={draggingTab === tabId}
                                    tabWidth={tabWidthRef.current}
                                    isNew={tabId === newTabId}
                                />
                            );
                        })}
                </div>
            </div>
            <button
                type="button"
                ref={addBtnRef}
                title="Add Tab"
                aria-label="Add tab"
                className={`shell-toolbar-button add-tab${noTabs ? " invisible" : ""}`}
                style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
                onClick={handleAddTab}
            >
                <i className="fa fa-solid fa-plus" />
            </button>
            <div className="flex-1" />
            <div ref={rightContainerRef} className="flex flex-row gap-1 items-end">
                <UpdateStatusBanner />
                <div
                    className="h-full shrink-0 z-window-drag"
                    style={{ width: windowDragRightWidth, WebkitAppRegion: "drag" } as any}
                />
            </div>
        </div>
    );
});

export { TabBar, WaveAIButton };
