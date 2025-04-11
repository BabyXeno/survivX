import React, {
    useEffect,
    useRef,
    useState,
    useCallback,
    StrictMode,
  } from "react";
  import { createRoot } from "react-dom/client";
  import $ from "jquery";
  import * as PIXI from "pixi.js-legacy";
  import OriginalApp from "./App";
  import { GameConfig } from "../../shared/gameConfig";
  import * as net from "../../shared/net/net";
  import { math } from "../../shared/utils/math";
  import { Account } from "./account";
  import { Ambiance } from "./ambiance";
  import { api } from "./api";
  import { AudioManager } from "./audioManager";
  import { ConfigManager, type ConfigType } from "./config";
  import { device } from "./device";
  import { Game } from "./game";
  import { helpers } from "./helpers";
  import { InputHandler } from "./input";
  import { InputBindUi, InputBinds } from "./inputBinds";
  import { PingTest } from "./pingTest";
  import { ResourceManager } from "./resources";
  import { SiteInfo } from "./siteInfo";
  import { LoadoutMenu } from "./ui/loadoutMenu";
  import { Localization } from "./ui/localization";
  import Menu from "./ui/menu";
  import { MenuModal } from "./ui/menuModal";
  import { LoadoutDisplay } from "./ui/opponentDisplay";
  import { Pass } from "./ui/pass";
  import { ProfileUi } from "./ui/profileUi";
  import { TeamMenu } from "./ui/teamMenu";
  import { loadStaticDomImages } from "./ui/ui2";
  // Better Season Pass Imports
  import {
    Shield,
    Zap,
    Crown,
    ShoppingCart,
    Settings,
    Facebook,
    Twitter,
    Instagram,
    Youtube,
    MessageSquare,
    X,
    ChevronDown,
  } from "lucide-react";
  // Import components
  import BuyItems from "./components/BuyItems.tsx";
  import SellItems from "./components/SellItems.tsx";
  // Import types
  import {
    Mission,
    Streamer,
    Reward,
    LoadoutItem,
  } from "./types/types.ts";
  // Import data
  import {
    missions,
    streamers,
    freePassRewards,
    premiumPassRewards,
  } from "./data/data.ts";
  
  import {
    getRarityColor,
    getRarityGlow,
    getRarityBorder,
    getRarityTextColor,
  } from "../../server/src/utils/utils";
  import "../../client/css/index.css";
  import "../../client/css/app.css";
  import "../../client/css/game.css";
  
  interface MatchData {
    zone: string;
    gameId: number;
    useHttps: boolean;
    hosts: string[];
    addrs: string[];
    data: string;
  }
  
  // The original GameContainer and application
  class Application {
    nameInput = $("#player-name-input-solo");
    serverSelect = $("#server-select-main");
    playMode0Btn = $("#btn-start-mode-0");
    playMode1Btn = $("#btn-start-mode-1");
    playMode2Btn = $("#btn-start-mode-2");
    muteBtns = $(".btn-sound-toggle");
    aimLineBtn = $("#btn-game-aim-line");
    masterSliders = $<HTMLInputElement>(".sl-master-volume");
    soundSliders = $<HTMLInputElement>(".sl-sound-volume");
    musicSliders = $<HTMLInputElement>(".sl-music-volume");
    serverWarning = $("#server-warning");
    languageSelect = $<HTMLSelectElement>(".language-select");
    startMenuWrapper = $("#start-menu-wrapper");
    gameAreaWrapper = $("#game-area-wrapper");
    playButtons = $(".play-button-container");
    playLoading = $(".play-loading-outer");
    errorModal = new MenuModal($("#modal-notification"));
    refreshModal = new MenuModal($("#modal-refresh"));
    config = new ConfigManager();
    localization = new Localization();
  
    account!: Account;
    loadoutMenu!: LoadoutMenu;
    pass!: Pass;
    profileUi!: ProfileUi;
  
    pingTest = new PingTest();
    audioManager = new AudioManager();
    ambience = new Ambiance();
  
    siteInfo!: SiteInfo;
    teamMenu!: TeamMenu;
  
    pixi: PIXI.Application<PIXI.ICanvas> | null = null;
    resourceManager: ResourceManager | null = null;
    input: InputHandler | null = null;
    inputBinds: InputBinds | null = null;
    inputBindUi: InputBindUi | null = null;
    game: Game | null = null;
    loadoutDisplay: LoadoutDisplay | null = null;
    domContentLoaded = false;
    configLoaded = false;
    initialized = false;
    active = false;
    sessionId = helpers.random64();
    contextListener = function (e: MouseEvent) {
      e.preventDefault();
    };
  
    errorMessage = "";
    quickPlayPendingModeIdx = -1;
    findGameAttempts = 0;
    findGameTime = 0;
    pauseTime = 0;
    wasPlayingVideo = false;
    checkedPingTest = false;
    hasFocus = true;
    newsDisplayed = true;
  
    constructor() {
      this.account = new Account(this.config);
      this.loadoutMenu = new LoadoutMenu(this.account, this.localization);
      this.pass = new Pass(this.account, this.loadoutMenu, this.localization);
      this.profileUi = new ProfileUi(
        this.account,
        this.localization,
        this.loadoutMenu,
        this.errorModal,
      );
      this.siteInfo = new SiteInfo(this.config, this.localization);
  
      this.teamMenu = new TeamMenu(
        this.config,
        this.pingTest,
        this.siteInfo,
        this.localization,
        this.audioManager,
        this.onTeamMenuJoinGame.bind(this),
        this.onTeamMenuLeave.bind(this),
      );
  
      const onLoadComplete = () => {
        this.config.load(() => {
          this.configLoaded = true;
          this.tryLoad();
        });
      };
      this.loadBrowserDeps(onLoadComplete);
    }
  
    loadBrowserDeps(onLoadCompleteCb: () => void) {
      onLoadCompleteCb();
    }
  
    tryLoad() {
      if (this.domContentLoaded && this.configLoaded && !this.initialized) {
        this.initialized = true;
        // this should be this.config.config.teamAutofill = true???
        // this.config.teamAutoFill = true;
        if (device.mobile) {
          Menu.applyMobileBrowserStyling(device.tablet);
        }
        const t = this.config.get("language") || this.localization.detectLocale();
        this.config.set("language", t);
        this.localization.setLocale(t);
        this.localization.populateLanguageSelect();
        this.startPingTest();
        this.siteInfo.load();
        this.localization.localizeIndex();
        this.account.init();
  
        (this.nameInput as unknown as HTMLInputElement).maxLength =
          net.Constants.PlayerNameMaxLen;
        this.playMode0Btn.on("click", () => {
          this.tryQuickStartGame(0);
        });
        this.playMode1Btn.on("click", () => {
          this.tryQuickStartGame(1);
        });
        this.playMode2Btn.on("click", () => {
          this.tryQuickStartGame(2);
        });
        this.serverSelect.change(() => {
          const t = this.serverSelect.find(":selected").val();
          this.config.set("region", t as string);
        });
        this.nameInput.on("blur", (_t) => {
          this.setConfigFromDOM();
        });
        this.muteBtns.on("click", (_t) => {
          this.config.set("muteAudio", !this.config.get("muteAudio"));
        });
        this.muteBtns.on("mousedown", (e) => {
          e.stopPropagation();
        });
        $(this.masterSliders).on("mousedown", (e) => {
          e.stopPropagation();
        });
        $(this.soundSliders).on("mousedown", (e) => {
          e.stopPropagation();
        });
        $(this.musicSliders).on("mousedown", (e) => {
          e.stopPropagation();
        });
        this.masterSliders.on("input", (t) => {
          const r = Number($(t.target).val()) / 100;
          this.audioManager.setMasterVolume(r);
          this.config.set("masterVolume", r);
        });
        this.soundSliders.on("input", (t) => {
          const r = Number($(t.target).val()) / 100;
          this.audioManager.setSoundVolume(r);
          this.config.set("soundVolume", r);
        });
        this.musicSliders.on("input", (t) => {
          const r = Number($(t.target).val()) / 100;
          this.audioManager.setMusicVolume(r);
          this.config.set("musicVolume", r);
        });
        $(".modal-settings-item")
          .children("input")
          .each((_t, r) => {
            const a = $(r);
            a.prop("checked", this.config.get(a.prop("id")));
          });
        $(".modal-settings-item > input:checkbox").change((t) => {
          const r = $(t.target);
          this.config.set(r.prop("id"), r.is(":checked"));
        });
        $(".btn-fullscreen-toggle").on("click", () => {
          helpers.toggleFullScreen();
        });
        this.languageSelect.on("change", (t) => {
          const r = (t.target as HTMLSelectElement).value;
          if (r) {
            this.config.set("language", r as ConfigType["language"]);
          }
        });
        $("#btn-create-team").on("click", () => {
          this.tryJoinTeam(true);
        });
        $("#btn-team-mobile-link-join").on("click", () => {
          let t = $<HTMLInputElement>("#team-link-input").val()?.trim()!;
          const r = t.indexOf("#");
          if (r >= 0) {
            t = t.slice(r + 1);
          }
          if (t.length > 0) {
            $("#team-mobile-link").css("display", "none");
            this.tryJoinTeam(false, t);
          } else {
            $("#team-mobile-link-desc").css("display", "none");
            $("#team-mobile-link-warning").css("display", "none").fadeIn(100);
          }
        });
        $("#btn-team-leave").on("click", () => {
          if (window.history) {
            window.history.replaceState("", "", "/");
          }
          $("#news-block").css("display", "block");
          this.game?.free();
          this.teamMenu.leave();
        });
        const r = $("#news-current").data("date");
        const a = new Date(r).getTime();
        $(".right-column-toggle").on("click", () => {
          if (this.newsDisplayed) {
            $("#news-wrapper").fadeOut(250);
            $("#pass-wrapper").fadeIn(250);
          } else {
            this.config.set("lastNewsTimestamp", a);
            $(".news-toggle").find(".account-alert").css("display", "none");
            $("#news-wrapper").fadeIn(250);
            $("#pass-wrapper").fadeOut(250);
          }
          this.newsDisplayed = !this.newsDisplayed;
        });
        const i = this.config.get("lastNewsTimestamp")!;
        if (a > i) {
          $(".news-toggle").find(".account-alert").css("display", "block");
        }
        this.setDOMFromConfig();
        this.setAppActive(true);
        const domCanvas = document.querySelector<HTMLCanvasElement>("#cvs")!;
  
        const rendererRes = window.devicePixelRatio > 1 ? 2 : 1;
  
        if (device.os == "ios") {
          PIXI.settings.PRECISION_FRAGMENT = PIXI.PRECISION.HIGH;
        }
  
        const createPixiApplication = (forceCanvas: boolean) => {
          return new PIXI.Application({
            width: window.innerWidth,
            height: window.innerHeight,
            view: domCanvas,
            antialias: false,
            resolution: rendererRes,
            hello: true,
            forceCanvas,
          });
        };
        let pixi = null;
        try {
          pixi = createPixiApplication(false);
        } catch (_e) {
          pixi = createPixiApplication(true);
        }
        this.pixi = pixi;
        this.pixi.renderer.events.destroy();
        this.pixi.ticker.add(this.update, this);
        this.pixi.renderer.background.color = 7378501;
        this.resourceManager = new ResourceManager(
          this.pixi.renderer,
          this.audioManager,
          this.config,
        );
        this.resourceManager.loadMapAssets("main");
        this.input = new InputHandler(document.getElementById("game-touch-area")!);
        this.inputBinds = new InputBinds(this.input, this.config);
        this.inputBindUi = new InputBindUi(this.input, this.inputBinds);
        const onJoin = () => {
          this.loadoutDisplay!.free();
          this.game!.init();
          this.onResize();
          this.findGameAttempts = 0;
          this.ambience.onGameStart();
        };
        const onQuit = (errMsg?: string) => {
          if (this.game!.m_updatePass) {
            this.pass.scheduleUpdatePass(this.game!.m_updatePassDelay);
          }
          this.game!.free();
          this.errorMessage = this.localization.translate(errMsg || "");
          this.teamMenu.onGameComplete();
          this.ambience.onGameComplete(this.audioManager);
          this.setAppActive(true);
          this.setPlayLockout(false);
          if (errMsg == "index-invalid-protocol") {
            this.showInvalidProtocolModal();
          }
        };
        this.game = new Game(
          this.pixi,
          this.audioManager,
          this.localization,
          this.config,
          this.input,
          this.inputBinds,
          this.inputBindUi,
          this.ambience,
          this.resourceManager,
          onJoin,
          onQuit,
        );
        this.loadoutDisplay = new LoadoutDisplay(
          this.pixi,
          this.audioManager,
          this.config,
          this.inputBinds,
          this.account,
        );
        this.loadoutMenu.loadoutDisplay = this.loadoutDisplay;
        this.onResize();
        this.tryJoinTeam(false);
        Menu.setupModals(this.inputBinds, this.inputBindUi);
        this.onConfigModified();
        this.config.addModifiedListener(this.onConfigModified.bind(this));
        loadStaticDomImages();
      }
    }
  
    onUnload() {
      this.teamMenu.leave();
    }
  
    onResize() {
      device.onResize();
      Menu.onResize();
      this.loadoutMenu.onResize();
      this.pixi?.renderer.resize(device.screenWidth, device.screenHeight);
      if (this.game?.initialized) {
        this.game.resize();
      }
      if (this.loadoutDisplay?.initialized) {
        this.loadoutDisplay.resize();
      }
      this.refreshUi();
    }
  
    startPingTest() {
      const regions = this.config.get("regionSelected")
        ? [this.config.get("region")!]
        : this.pingTest.getRegionList();
      this.pingTest.start(regions);
    }
  
    setAppActive(active: boolean) {
      this.active = active;
      this.quickPlayPendingModeIdx = -1;
      this.refreshUi();
  
      // Certain systems, like the account, can throw errors
      // while the user is already in a game.
      // Seeing these errors when returning to the menu would be
      // confusing, so we'll hide the modal instead.
      if (active) {
        this.errorModal.hide();
      }
    }
  
    setPlayLockout(lock: boolean) {
      const delay = lock ? 0 : 1000;
      this.playButtons
        .stop()
        .delay(delay)
        .animate(
          {
            opacity: lock ? 0.5 : 1,
          },
          250,
        );
      this.playLoading
        .stop()
        .delay(delay)
        .animate(
          {
            opacity: lock ? 1 : 0,
          },
          {
            duration: 250,
            start: () => {
              this.playLoading.css({
                "pointer-events": lock ? "initial" : "none",
              });
            },
          },
        );
    }
  
    onTeamMenuJoinGame(data: MatchData) {
      this.waitOnAccount(() => {
        this.joinGame(data);
      });
    }
  
    onTeamMenuLeave(errTxt = "") {
      if (errTxt && errTxt != "" && window.history) {
        window.history.replaceState("", "", "/");
      }
      this.errorMessage = errTxt;
      this.setDOMFromConfig();
      this.refreshUi();
    }
  
    // Config
    setConfigFromDOM() {
      const playerName = helpers.sanitizeNameInput(
        this.nameInput.val() as string,
      );
      this.config.set("playerName", playerName);
      const region = this.serverSelect.find(":selected").val();
      this.config.set("region", region as string);
    }
  
    setDOMFromConfig() {
      this.nameInput.val(this.config.get("playerName")!);
      this.serverSelect.find("option").each((_i, ele) => {
        ele.selected = ele.value == this.config.get("region");
      });
      this.languageSelect.val(this.config.get("language")!);
    }
  
    onConfigModified(key?: string) {
      const muteAudio = this.config.get("muteAudio")!;
      if (muteAudio != this.audioManager.mute) {
        this.muteBtns.removeClass(muteAudio ? "audio-on-icon" : "audio-off-icon");
        this.muteBtns.addClass(muteAudio ? "audio-off-icon" : "audio-on-icon");
        this.audioManager.setMute(muteAudio);
      }
  
      const masterVolume = this.config.get("masterVolume")!;
      this.masterSliders.val(masterVolume * 100);
      this.audioManager.setMasterVolume(masterVolume);
  
      const soundVolume = this.config.get("soundVolume")!;
      this.soundSliders.val(soundVolume * 100);
      this.audioManager.setSoundVolume(soundVolume);
  
      const musicVolume = this.config.get("musicVolume")!;
      this.musicSliders.val(musicVolume * 100);
      this.audioManager.setMusicVolume(musicVolume);
  
      if (key == "language") {
        const language = this.config.get("language")!;
        this.localization.setLocale(language);
      }
  
      if (key == "region") {
        this.config.set("regionSelected", true);
        this.startPingTest();
      }
  
      if (key == "highResTex") {
        location.reload();
      }
    }
  
    refreshUi() {
      this.startMenuWrapper.css("display", this.active ? "flex" : "none");
      this.gameAreaWrapper.css({
        display: this.active ? "none" : "block",
        opacity: this.active ? 0 : 1,
      });
      if (this.active) {
        $("body").removeClass("user-select-none");
        document.removeEventListener("contextmenu", this.contextListener);
      } else {
        $("body").addClass("user-select-none");
        $("#start-main").stop(true);
        document.addEventListener("contextmenu", this.contextListener);
      }
  
      // Hide the left section if on mobile, oriented portrait, and viewing create team
      $("#ad-block-left").css(
        "display",
        !device.isLandscape && this.teamMenu.active ? "none" : "block",
      );
  
      // Warning
      const hasError = this.active && this.errorMessage != "";
      this.serverWarning.css({
        display: "block",
        opacity: hasError ? 1 : 0,
      });
      this.serverWarning.html(this.errorMessage);
  
      const updateButton = (ele: JQuery<HTMLElement>, gameModeIdx: number) => {
        ele.html(
          this.quickPlayPendingModeIdx === gameModeIdx
            ? '<div class="ui-spinner"></div>'
            : this.localization.translate(ele.data("l10n")),
        );
      };
  
      updateButton(this.playMode0Btn, 0);
      updateButton(this.playMode1Btn, 1);
      updateButton(this.playMode2Btn, 2);
    }
  
    waitOnAccount(cb: () => void) {
      if (this.account.requestsInFlight == 0) {
        cb();
      } else {
        // Wait some maximum amount of time for pending account requests
        const timeout = setTimeout(() => {
          runOnce();
        }, 2500);
        const runOnce = () => {
          cb();
          clearTimeout(timeout);
          this.account.removeEventListener("requestsComplete", runOnce);
        };
        this.account.addEventListener("requestsComplete", runOnce);
      }
    }
  
    tryJoinTeam(create: boolean, url?: string) {
      if (this.active && this.quickPlayPendingModeIdx === -1) {
        // Join team if the url contains a team address
        const roomUrl = url || window.location.hash.slice(1);
        if (create || roomUrl != "") {
          // The main menu and squad menus have separate
          // DOM elements for input, such as player name and
          // selected region. We will stash the menu values
          // into the config so the team menu can read them.
          this.setConfigFromDOM();
          this.teamMenu.connect(create, roomUrl);
          this.refreshUi();
        }
      }
    }
  
    tryQuickStartGame(gameModeIdx: number) {
      if (this.quickPlayPendingModeIdx === -1) {
        // Update UI to display a spinner on the play button
        this.errorMessage = "";
        this.quickPlayPendingModeIdx = gameModeIdx;
        this.setConfigFromDOM();
        this.refreshUi();
  
        // Wait some amount of time if we've recently attempted to
        // find a game to prevent spamming the server
        let delay = 0;
        if (this.findGameAttempts > 0 && Date.now() - this.findGameTime < 30000) {
          delay = Math.min(this.findGameAttempts * 2.5 * 1000, 7500);
        } else {
          this.findGameAttempts = 0;
        }
        this.findGameTime = Date.now();
        this.findGameAttempts++;
  
        const version = GameConfig.protocolVersion;
        let region = this.config.get("region")!;
        const paramRegion = helpers.getParameterByName("region");
        if (paramRegion !== undefined && paramRegion.length > 0) {
          region = paramRegion;
        }
        let zones = this.pingTest.getZones(region);
        const paramZone = helpers.getParameterByName("zone");
        if (paramZone !== undefined && paramZone.length > 0) {
          zones = [paramZone];
        }
  
        const matchArgs = {
          version,
          region,
          zones,
          playerCount: 1,
          autoFill: true,
          gameModeIdx,
        };
  
        const tryQuickStartGameImpl = () => {
          this.waitOnAccount(() => {
            this.findGame(matchArgs, (err, matchData) => {
              if (err) {
                this.onJoinGameError(err);
                return;
              }
              this.joinGame(matchData!);
            });
          });
        };
  
        if (delay == 0) {
          // We can improve findGame responsiveness by ~30 ms by skipping
          // the 0ms setTimeout
          tryQuickStartGameImpl();
        } else {
          setTimeout(() => {
            tryQuickStartGameImpl();
          }, delay);
        }
      }
    }
  
    findGame(
      matchArgs: unknown,
      cb: (err?: string | null, matchData?: MatchData) => void,
    ) {
      (function findGameImpl(iter, maxAttempts) {
        if (iter >= maxAttempts) {
          cb("full");
          return;
        }
        const retry = function () {
          setTimeout(() => {
            findGameImpl(iter + 1, maxAttempts);
          }, 500);
        };
        $.ajax({
          type: "POST",
          url: api.resolveUrl("/api/find_game"),
          data: JSON.stringify(matchArgs),
          contentType: "application/json; charset=utf-8",
          timeout: 10 * 1000,
          success: function (data: { err?: string; res: [MatchData] }) {
            if (data?.err && data.err != "full") {
              cb(data.err);
              return;
            }
            const matchData = data?.res ? data.res[0] : null;
            if (matchData?.hosts && matchData.addrs) {
              cb(null, matchData);
            } else {
              retry();
            }
          },
          error: function (_e) {
            retry();
          },
        });
      })(0, 2);
    }
  
    joinGame(matchData: MatchData) {
      if (!this.game) {
        setTimeout(() => {
          this.joinGame(matchData);
        }, 250);
        return;
      }
      const hosts = matchData.hosts || [];
      const urls: string[] = [];
      for (let i = 0; i < hosts.length; i++) {
        urls.push(
          `ws${matchData.useHttps ? "s" : ""}://${hosts[i]}/play?gameId=${
            matchData.gameId
          }`,
        );
      }
      const joinGameImpl = (urls: string[], matchData: MatchData) => {
        const url = urls.shift();
        if (!url) {
          this.onJoinGameError("join_game_failed");
          return;
        }
        const onFailure = function () {
          joinGameImpl(urls, matchData);
        };
        this.game!.tryJoinGame(
          url,
          matchData.data,
          this.account.loadoutPriv,
          this.account.questPriv,
          onFailure,
        );
      };
      joinGameImpl(urls, matchData);
    }
  
    onJoinGameError(err: string) {
      const errMap = {
        full: this.localization.translate("index-failed-finding-game"),
        invalid_protocol: this.localization.translate("index-invalid-protocol"),
        join_game_failed: this.localization.translate("index-failed-joining-game"),
      };
      if (err == "invalid_protocol") {
        this.showInvalidProtocolModal();
      }
      this.errorMessage = errMap[err as keyof typeof errMap] || errMap.full;
      this.quickPlayPendingModeIdx = -1;
      this.teamMenu.leave("join_game_failed");
      this.refreshUi();
    }
  
    showInvalidProtocolModal() {
      this.refreshModal.show(true);
    }
  
    update() {
      const dt = math.clamp(this.pixi!.ticker.elapsedMS / 1000, 0.001, 1 / 8);
      this.pingTest.update(dt);
      if (!this.checkedPingTest && this.pingTest.isComplete()) {
        if (!this.config.get("regionSelected")) {
          const region = this.pingTest.getRegion();
  
          if (region) {
            this.config.set("region", region);
            this.setDOMFromConfig();
          }
        }
        this.checkedPingTest = true;
      }
      this.resourceManager!.update(dt);
      this.audioManager.update(dt);
      this.ambience.update(dt, this.audioManager, !this.active);
      this.teamMenu.update(dt);
  
      // Game update
      if (this.game?.initialized && this.game.m_playing) {
        if (this.active) {
          this.setAppActive(false);
          this.setPlayLockout(true);
        }
        this.game.update(dt);
      }
  
      // LoadoutDisplay update
      if (
        this.active &&
        this.loadoutDisplay &&
        this.game &&
        !this.game.initialized
      ) {
        if (this.loadoutMenu.active) {
          if (!this.loadoutDisplay.initialized) {
            this.loadoutDisplay.init();
          }
          this.loadoutDisplay.show();
          this.loadoutDisplay.update(dt, this.hasFocus);
        } else {
          this.loadoutDisplay.hide();
        }
      }
      if (!this.active && this.loadoutMenu.active) {
        this.loadoutMenu.hide();
      }
      if (this.active) {
        this.pass?.update(dt);
      }
      this.input!.flush();
    }
  }
  
  // React Component to Host the Game
  function GameContainer() {
    const appRef = useRef<Application | null>(null);
    const betterPassContainerRef = useRef<HTMLDivElement>(null);
  
    useEffect(() => {
      // Initialize the game application
      appRef.current = new Application();
  
      const onPageLoad = () => {
        appRef.current!.domContentLoaded = true;
        appRef.current!.tryLoad();
      };
  
      document.addEventListener("DOMContentLoaded", onPageLoad);
      window.addEventListener("load", onPageLoad);
      window.addEventListener("unload", (_e) => {
        appRef.current!.onUnload();
      });
      if (window.location.hash == "#_=_") {
        window.location.hash = "";
        history.pushState("", document.title, window.location.pathname);
      }
      window.addEventListener("resize", () => {
        appRef.current!.onResize();
      });
      window.addEventListener("orientationchange", () => {
        appRef.current!.onResize();
      });
      window.addEventListener("hashchange", () => {
        appRef.current!.tryJoinTeam(false);
      });
      window.addEventListener("beforeunload", (e) => {
        if (appRef.current!.game?.warnPageReload()) {
          // In new browsers, dialogText is overridden by a generic string
          const dialogText = "Do you want to reload the game?";
          e.returnValue = dialogText;
          return dialogText;
        }
      });
      window.addEventListener("onfocus", () => {
        appRef.current!.hasFocus = true;
      });
      window.addEventListener("onblur", () => {
        appRef.current!.hasFocus = false;
      });
  
      const reportedErrors: string[] = [];
      window.onerror = function (msg, url, lineNo, columnNo, error) {
        msg = msg || "undefined_error_msg";
        const stacktrace = error ? error.stack : "";
  
        const errObj = {
          msg,
          id: appRef.current!.sessionId,
          url,
          line: lineNo,
          column: columnNo,
          stacktrace,
          browser: navigator.userAgent,
          protocol: GameConfig.protocolVersion,
          clientGitVersion: GIT_VERSION,
          serverGitVersion: appRef.current!.siteInfo.info.gitRevision,
        };
        const errStr = JSON.stringify(errObj);
  
        // Don't report the same error multiple times
        if (!reportedErrors.includes(errStr)) {
          reportedErrors.push(errStr);
          console.error("windowOnError", errStr);
        }
      };
  
      navigator.serviceWorker?.getRegistrations().then((registrations) => {
        for (const registration of registrations) {
          registration.unregister();
        }
      });
  
      // Cleanup on unmount
      return () => {
        document.removeEventListener("DOMContentLoaded", onPageLoad);
        window.removeEventListener("load", onPageLoad);
        window.removeEventListener("unload", (_e) => {
          appRef.current!.onUnload();
        });
        window.removeEventListener("resize", () => {
          appRef.current!.onResize();
        });
        window.removeEventListener("orientationchange", () => {
          appRef.current!.onResize();
        });
        window.removeEventListener("hashchange", () => {
          appRef.current!.tryJoinTeam(false);
        });
        window.removeEventListener("beforeunload", (e) => {
          if (appRef.current!.game?.warnPageReload()) {
            // In new browsers, dialogText is overridden        // by a generic string
          const dialogText = "Do you want to reload the game?";
          e.returnValue = dialogText;
          return dialogText;
        }
      });
      window.removeEventListener("onfocus", () => {
        appRef.current!.hasFocus = true;
      });
      window.removeEventListener("onblur", () => {
        appRef.current!.hasFocus = false;
      });
    };
  }, []);

  // Better Pass code goes directly into the GameContainer

  const [currentLevel] = useState(5);
  const [goldAmount] = useState(3580);
  const [showBundleModal, setShowBundleModal] = useState(false);
  const [shopBundleTime, setShopBundleTime] = useState("1h 50m 54s");
  const [scrollPosition, setScrollPosition] = useState(0);
  const [activeReward, setActiveReward] = useState<Reward | null>(null);
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [isSoloDropdownOpen, setIsSoloDropdownOpen] = useState(false);
  const [selectedMode, setSelectedMode] = useState("Solo");
  const [isClassicDropdownOpen, setIsClassicDropdownOpen] = useState(false);
  const [selectedGameType, setSelectedGameType] = useState("Classic");
  const [seasonEnds, setSeasonEnds] = useState("82d 22h 35m 0s");
  const [exclusiveOffersTime, setExclusiveOffersTime] = useState("04h 1m 50s");
  const [activeShopMode, setActiveShopMode] = useState<"buy" | "sell" | null>(
    null,
  );

  const toggleClassicDropdown = () => {
    setIsClassicDropdownOpen(!isClassicDropdownOpen);
  };

  const selectGameType = (gameType: string) => {
    setSelectedGameType(gameType);
    setIsClassicDropdownOpen(false);
  };

  const handleBabyXenoClick = () => {
    window.open("https://www.youtube.com/@Baby_Xeno", "_blank");
  };

  const toggleSoloDropdown = () => {
    setIsSoloDropdownOpen(!isSoloDropdownOpen);
  };

  const selectMode = (mode: string) => {
    setSelectedMode(mode);
    setIsSoloDropdownOpen(false);
  };
  const handleBuyItemClick = () => {
    setActiveShopMode("buy");
  };

  const handleSellItemClick = () => {
    setActiveShopMode("sell");
  };

  const closeShopMode = () => {
    setActiveShopMode(null);
  };
  const battlePassTitlePosition = {
    top: 430,
    left: 487,
  };
  useEffect(() => {
    let shopBundleInterval: any;
    let seasonEndsInterval: any;
    let exclusiveOffersInterval: any;

    const calculateTimeLeft = (timeString: string) => {
      const [hours, minutes, seconds] = timeString
        .split(/[hms ]/)
        .filter((item) => item !== "");

      let totalSeconds =
        parseInt(hours || "0") * 3600 +
        parseInt(minutes || "0") * 60 +
        parseInt(seconds || "0");

      return totalSeconds;
    };

    const updateShopBundleTime = () => {
      setShopBundleTime((prevTime) => {
        let totalSeconds = calculateTimeLeft(prevTime);

        totalSeconds--;

        if (totalSeconds < 0) {
          totalSeconds = 24 * 3600;
        }

        const newHours = Math.floor(totalSeconds / 3600);
        const newMinutes = Math.floor((totalSeconds % 3600) / 60);
        const newSeconds = totalSeconds % 60;

        const formatTime = (value: number) => String(value).padStart(2, "0");

        return `${formatTime(newHours)}h ${formatTime(newMinutes)}m ${formatTime(
          newSeconds,
        )}s`;
      });
    };

    const updateSeasonEnds = () => {
      setSeasonEnds((prevTime) => {
        const [days, hours, minutes, seconds] = prevTime
          .split(/[d hms ]/)
          .filter((item) => item !== "");

        let totalSeconds =
          parseInt(days || "0") * 24 * 3600 +
          parseInt(hours || "0") * 3600 +
          parseInt(minutes || "0") * 60 +
          parseInt(seconds || "0");

        totalSeconds--;

        if (totalSeconds < 0) {
          return "Season Ended!";
        }

        const newDays = Math.floor(totalSeconds / (24 * 3600));
        const newHours = Math.floor((totalSeconds % (24 * 3600)) / 3600);
        const newMinutes = Math.floor((totalSeconds % 3600) / 60);
        const newSeconds = totalSeconds % 60;

        const formatTime = (value: number) => String(value).padStart(2, "0");

        return `${formatTime(newDays)}d ${formatTime(newHours)}h ${formatTime(
          newMinutes,
        )}m ${formatTime(newSeconds)}s`;
      });
    };

    const updateExclusiveOffersTime = () => {
      setExclusiveOffersTime((prevTime) => {
        let totalSeconds = calculateTimeLeft(prevTime);

        totalSeconds--;

        if (totalSeconds < 0) {
          totalSeconds = 24 * 3600;
        }

        const newHours = Math.floor(totalSeconds / 3600);
        const newMinutes = Math.floor((totalSeconds % 3600) / 60);
        const newSeconds = totalSeconds % 60;

        const formatTime = (value: number) => String(value).padStart(2, "0");

        return `${formatTime(newHours)}h ${formatTime(newMinutes)}m ${formatTime(
          newSeconds,
        )}s`;
      });
    };

    shopBundleInterval = setInterval(updateShopBundleTime, 1000);
    seasonEndsInterval = setInterval(updateSeasonEnds, 1000);
    exclusiveOffersInterval = setInterval(updateExclusiveOffersTime, 1000);

    return () => {
      clearInterval(shopBundleInterval);
      clearInterval(seasonEndsInterval);
      clearInterval(exclusiveOffersInterval);
    };
  }, []);
  const handleScroll = (event: WheelEvent) => {
    event.preventDefault();

    if (betterPassContainerRef.current) {
      betterPassContainerRef.current.scrollLeft += event.deltaY;
      setScrollPosition(betterPassContainerRef.current.scrollLeft);
    }
  };

  useEffect(() => {
    if (betterPassContainerRef.current) {
      betterPassContainerRef.current.addEventListener("wheel", handleScroll);

      return () => {
        betterPassContainerRef.current?.removeEventListener(
          "wheel",
          handleScroll,
        );
      };
    }
  }, []);
  const playerInfoPosition = {
    top: 225,
    left: 1042,
  };
  const battlePosition = {
    top: 330,
    left: 1042,
  };
  const unlockAllPosition = {
    top: 450,
    left: 644,
  };
  const seasonEndsPosition = {
    top: 510,
    left: 673,
  };

  const socialLinksPosition = {
    top: 50,
    left: 1385,
  };
  const googlePlayPosition = {
    top: 350,
    left: 20,
  };
  const appStorePosition = {
    top: 410,
    left: 20,
  };
  const battlePassRewardsPosition = {
    top: 225,
    left: 512,
  };
  const streamingBoxPosition = {
    top: 50,
    left: 20,
  };
  const missionsBoxPosition = {
    top: 225,
    left: 295,
  };
  const xpBoostBoxPosition = {
    top: 465,
    left: 295,
  };
  const rewardWidth = 96;
  const containerWidth = 5 * rewardWidth;
  const scrollContainerRef = useRef<HTMLDivElement>(null); // Reference for scrollable container
  return (
    <div ref={betterPassContainerRef}>
      <div
        className="min-h-screen bg-cover bg-center relative"
        style={{
          backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.7), rgba(0, 0, 0, 0.7)),
                             url(/Better_Pass/images/background.png)`,
        }}
      >
        {/* Top Navigation */}
        <div className="bg-transparent p-2 flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <div className="bg-[#333300] px-3 py-1 rounded-md flex items-center border border-yellow-500">
              <img
                src="/Better_Pass/images/imagegp.png"
                alt="GP"
                className="w-4 h-4 mr-2"
              />
              <span className="text-yellow-400 font-bold">{goldAmount}</span>
            </div>
            <button
              className="bg-purple-700 hover:bg-purple-800 px-4 py-1 rounded-md flex items-center"
              onClick={() => setShowBundleModal(true)}
            >
              <ShoppingCart size={16} className="mr-2" />
              SHOP
              <span className="text-xs ml-2 text-gray-300">
                New Bundles: {shopBundleTime}
              </span>
            </button>
          </div>

          <div className="flex items-center space-x-4">
            <button className="bg-gray-700 hover:bg-gray-600 p-2 rounded-md">
              <Settings size={16} />
            </button>
            <button className="bg-purple-700 hover:bg-purple-800 px-4 py-1 rounded-md">
              LOGIN
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-6xl mx-auto grid grid-cols-12 gap-4 p-4">
          {/* Left Column - Streaming & Missions */}
          <div className="col-span-3">
            {/* Streaming Section */}
            <div
              className="rounded-lg p-4 mb-4"
              style={{
                position: "absolute",
                top: streamingBoxPosition.top,
                left: streamingBoxPosition.left,
                backgroundColor: "transparent",
                color: "white",
                borderColor: "transparent",
                borderWidth: "0px",
              }}
            >
              <h2 className="text-lg font-bold mb-4 flex items-center text-white">
                Streaming Live!
              </h2>
              <div className="space-y-3">
                {streamers.map((streamer) => (
                  <div
                    key={streamer.id}
                    className="flex items-center space-x-2"
                  >
                    <img
                      src={streamer.avatar}
                      alt={streamer.name}
                      className="w-8 h-8 rounded-full"
                    />
                    <div className="flex-1">
                      <div className="text-sm font-medium text-yellow-400">
                        {streamer.name}
                      </div>
                      <div className="text-xs text-gray-400">
                        {streamer.viewers} viewers
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {/* Featured YouTuber */}
              <div className="mt-4 pt-4 border-t border-gray-700">
                <h3 className="text-sm font-bold mb-2">Featured YouTuber</h3>
                <div className="flex items-center space-x-2">
                  <div className="text-red-500">
                    <Youtube size={20} />
                  </div>
                  <div
                    className="text-sm cursor-pointer hover:text-red-500"
                    onClick={handleBabyXenoClick}
                  >
                    Baby_Xeno
                  </div>
                </div>
              </div>
            </div>

            {/* Missions Section */}
            <div
              className="bg-black rounded-lg p-4 mb-4 border border-gray-800"
              style={{
                position: "absolute",
                top: missionsBoxPosition.top,
                left: missionsBoxPosition.left,
              }}
            >
              <h2 className="text-xl font-bold mb-4 text-center text-yellow-400">
                MISSIONS
              </h2>
              <div className="space-y-4">
                {missions.map((mission) => (
                  <div key={mission.id} className="space-y-2">
                    <div className="flex justify-between text-sm text-yellow-400">
                      <span>{mission.title}</span>
                      <span className="flex items-center">
                        {mission.xp} XP <Zap size={14} className="ml-1" />
                      </span>
                    </div>
                    <div className="h-2 bg-[#3a3a3a] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-green-500"
                        style={{
                          width: `${(mission.progress / mission.total) * 100}%`,
                        }}
                      />
                    </div>
                    <div className="text-right text-sm text-yellow-400">
                      {mission.progress} / {mission.total}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {/* Updated Google Play Button */}
            <div
              style={{
                position: "absolute",
                top: googlePlayPosition.top,
                left: googlePlayPosition.left,
              }}
            >
              <a
                href="#"
                className="block bg-black hover:bg-gray-900 p-2 rounded-lg mb-3 border border-gray-800"
                style={{ width: "170px" }}
              >
                <div className="flex items-center">
                  <div className="w-8 h-8 mr-2">
                    <img
                      src="/Better_Pass/images/imagegoogle.png"
                      alt="Google Play"
                      className="w-8 h-8"
                    />
                  </div>
                  <div>
                    <div className="text-gray-400 text-xs">GET IT ON</div>
                    <div className="text-white font-medium text-sm">
                      Google Play
                    </div>
                  </div>
                </div>
              </a>
            </div>

            {/* Updated App Store Button */}
            <div
              style={{
                position: "absolute",
                top: appStorePosition.top,
                left: appStorePosition.left,
              }}
            >
              <a
                href="#"
                className="block bg-black hover:bg-gray-900 p-2 rounded-lg border border-gray-800"
                style={{ width: "170px" }}
              >
                <div className="flex items-center">
                  <div className="w-8 h-8 mr-2">
                    <img
                      src="/Better_Pass/images/imageapple.png"
                      alt="App Store"
                      className="w-8 h-8"
                    />
                  </div>
                  <div>
                    <div className="text-gray-400 text-xs">
                      Download on the
                    </div>
                    <div className="text-white font-medium text-sm">
                      App Store
                    </div>
                  </div>
                </div>
              </a>
            </div>

            {/* Mobile App Section */}
            <div
              className="bg-black rounded-lg p-4 border border-gray-800 text-yellow-400"
              style={{
                position: "absolute",
                top: xpBoostBoxPosition.top,
                left: xpBoostBoxPosition.left,
              }}
            >
              <div className="text-center mb-4">
                <p className="text-sm">
                  Get <span className="font-bold">XP Boost</span> on Mobile App
                </p>
              </div>

              {/*  Removed the grid here */}
              <button className="w-full bg-yellow-500 hover:bg-yellow-600 text-black font-bold py-2 rounded-lg flex items-center justify-center">
                Get Free GP
                <img
                  src="/Better_Pass/images/imagegp.png"
                  alt="GP"
                  className="w-4 h-4 ml-2"
                />
              </button>
            </div>
          </div>

          {/* Center Column - Battle Pass */}
          <div className="col-span-6">
            {/* Game Banner */}
            <div
              className="relative mx-auto mb-4"
              style={{ width: "400px", height: "144px" }}
            >
              <img
                src="/Better_Pass/images/banner.png"
                alt="Game Banner"
                className="w-full h-full object-cover rounded-md"
              />
            </div>

            {/* Battle Pass Header */}
            <div
              style={{
                position: "absolute",
                top: battlePassTitlePosition.top,
                left: battlePassTitlePosition.left,
              }}
            >
              <div
                style={{
                  transform: "rotate(-90deg)",
                  transformOrigin: "top left",
                  whiteSpace: "nowrap",
                }}
                className="text-xl font-bold flex items-center justify-center"
              >
                <Shield size={20} className="mr-2 text-green-400" />
                <span className="text-yellow-500">SurvivX.io Pass 1</span>
              </div>
            </div>
          </div>
          {/* Battle Pass Progress */}
          <div
            className="bg-black p-4 rounded-lg border border-gray-800 mb-4"
            style={{
              position: "absolute",
              top: battlePassRewardsPosition.top,
              left: battlePassRewardsPosition.left,
            }}
          >
            {/* Combined Battle Pass with Level Numbers */}
            <div
              className="relative"
              style={{ width: `${containerWidth}px` }}
            >
              {/* Scrollable Rewards Container */}
              <div
                className="flex overflow-x-auto scrollbar-hide"
                ref={scrollContainerRef}
                onScroll={(e) => {
                  const target = e.target as HTMLDivElement;
                  setScrollPosition(target.scrollLeft);
                }}
              >
                <div className="flex flex-col">
                  {/* Free Pass Rewards */}
                  <div className="flex">
                    {freePassRewards.map((reward, index) => (
                      <div
                        key={reward.id}
                        className="relative flex-shrink-0 w-24 cursor-pointer"
                        onClick={() => setActiveReward(reward)}
                      >
                        <div
                          className={`bg-gray-800 p-1 rounded border ${getRarityBorder(
                            reward.rarity,
                          )}`}
                        >
                          <div className="flex items-center justify-center h-12">
                            <img
                              src={reward.image}
                              alt={`Reward ${reward.id}`}
                              className="w-10 h-10 object-contain"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Level Numbers Track - Fixed between rewards */}
                  <div className="flex py-2 relative">
                    {/* Progression Line */}
                    <div
                      className="absolute top-1/2 left-0 h-[3px] bg-yellow-500"
                      style={{
                        width: `${(currentLevel / 25) * (25 * rewardWidth)}px`,
                        transform: "translateY(-50%)",
                      }}
                    />

                    {[...Array(25)].map((_, index) => {
                      const level = index + 1;
                      return (
                        <div
                          key={`level-${level}`}
                          className="flex-shrink-0 w-24"
                        >
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center mx-auto ${
                              level <= currentLevel
                                ? "bg-yellow-500 text-black"
                                : "bg-gray-700 text-white"
                            } font-bold text-sm relative`}
                            style={{ zIndex: 1 }}
                          >
                            {level}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Premium Pass Rewards */}
                  <div className="flex">
                    {premiumPassRewards.map((reward) => (
                      <div
                        key={reward.id}
                        className="relative flex-shrink-0 w-24 cursor-pointer"
                        onClick={() => setActiveReward(reward)}
                      >
                        <div
                          className={`bg-gray-800 p-1 rounded border ${getRarityBorder(
                            reward.rarity,
                          )}`}
                        >
                          <div className="flex items-center justify-center h-12">
                            <img
                              src={reward.image}
                              alt={`Reward ${reward.id}`}
                              className="w-10 h-10 object-contain"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Unlock Premium Button */}
          <div
            style={{
              position: "absolute",
              top: unlockAllPosition.top,
              left: unlockAllPosition.left,
            }}
          >
            <button
              className="w-full bg-yellow-500 hover:bg-yellow-600 text-black font-bold py-3 rounded-lg mb-4 relative overflow-hidden"
              onClick={() => setShowPremiumModal(true)}
            >
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-32 h-32 bg-yellow-400 rounded-full animate-ping opacity-20"></div>
              </div>
              <span className="relative z-10 flex items-center justify-center">
                <Crown size={20} className="mr-2" />
                UNLOCK ALL GOLD ITEMS
                <Crown size={20} className="ml-2" />
              </span>
            </button>
          </div>

          {/* Season Timer */}
          <div
            style={{
              position: "absolute",
              top: seasonEndsPosition.top,
              left: seasonEndsPosition.left,
            }}
          >
            <div className="text-center text-yellow-400 text-sm bg-black py-2 rounded-lg border border-yellow-600">
              Season Ends: {seasonEnds}
            </div>
          </div>
        </div>

        {/* Right Column - Player Info & Battle */}
        <div className="col-span-3">
          {/* Player Info */}
          <div
            className="bg-black rounded-lg p-4 mb-4 border border-gray-700"
            style={{
              position: "absolute",
              top: playerInfoPosition.top,
              left: playerInfoPosition.left,
            }}
          >
            <div className="flex items-center">
              <div className="relative">
                <img
                  src="/Better_Pass/images/imageprofile.png"
                  alt="Player Avatar"
                  className="w-16 h-16 rounded-full bg-orange-500"
                />
              </div>
              <div className="ml-4 flex-grow">
                <div className="bg-black text-yellow-300 text-center py-1 px-2 rounded mb-2 font-bold">
                  Prestige 0
                </div>
                <button className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-2 rounded">
                  Loadout
                </button>
              </div>
            </div>
          </div>

          {/* Battle Button */}
          <div
            style={{
              position: "absolute",
              top: battlePosition.top,
              left: battlePosition.left,
            }}
          >
            <div className="space-y-2">
              <button className="w-full bg-purple-600 hover:bg-purple-700 text-white text-xl font-bold py-3 rounded">
                Battle
              </button>
              <div className="grid grid-cols-2 gap-2">
                <div className="relative">
                  <button
                    className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 rounded flex items-center justify-center w-full"
                    onClick={toggleClassicDropdown}
                  >
                    <span className="mr-1">⚛️</span> {selectedGameType}{" "}
                    <ChevronDown size={16} className="ml-1" />
                  </button>

                  {isClassicDropdownOpen && (
                    <div className="absolute left-0 mt-1 w-full bg-green-700 border border-green-800 rounded shadow-md z-10">
                      <button
                        className="block w-full text-left px-4 py-2 text-white hover:bg-green-800"
                        onClick={() => selectGameType("Classic")}
                      >
                        Classic
                      </button>
                      <button
                        className="block w-full text-left px-4 py-2 text-white hover:bg-green-800"
                        onClick={() => selectGameType("Ranked")}
                      >
                        Ranked
                      </button>
                    </div>
                  )}
                </div>
                <div className="relative">
                  <button
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 rounded flex items-center justify-center w-full"
                    onClick={toggleSoloDropdown}
                  >
                    <span className="mr-1">🔮</span> {selectedMode}{" "}
                    <ChevronDown size={16} className="ml-1" />
                  </button>
                  {isSoloDropdownOpen && (
                    <div className="absolute left-0 mt-1 w-full bg-blue-700 border border-blue-800 rounded shadow-md z-10">
                      <button
                        className="block w-full text-left px-4 py-2 text-white hover:bg-blue-800"
                        onClick={() => selectMode("Solo")}
                      >
                        Solo
                      </button>
                      <button
                        className="block w-full text-left px-4 py-2 text-white hover:bg-blue-800"
                        onClick={() => selectMode("Duo")}
                      >
                        Duo
                      </button>
                      <button
                        className="block w-full text-left px-4 py-2 text-white hover:bg-blue-800"
                        onClick={() => selectMode("Squads")}
                      >
                        Squads
                      </button>
                    </div>
                  )}
                </div>
              </div>
              <button className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 rounded">
                Make Team
              </button>
            </div>
          </div>

          {/* Social Links */}
          <div
            style={{
              position: "absolute",
              top: socialLinksPosition.top,
              left: socialLinksPosition.left,
            }}
          >
            <div className="flex justify-center space-x-2 mt-4">
              <a
                href="#"
                className="text-blue-500 hover:text-blue-400 transition-colors"
              >
                <Facebook size={20} />
              </a>
              <a
                href="#"
                className="text-blue-400 hover:text-blue-300 transition-colors"
              >
                <Twitter size={20} />
              </a>
              <a
                href="#"
                className="text-pink-500 hover:text-pink-400 transition-colors"
              >
                <Instagram size={20} />
              </a>
              <a
                href="#"
                className="text-red-500 hover:text-red-400 transition-colors"
              >
                <Youtube size={20} />
              </a>
              <a
                href="#"
                className="text-purple-500 hover:text-purple-400 transition-colors"
              >
                <MessageSquare size={20} />
              </a>
            </div>
          </div>
        </div>

        {/* Premium Modal */}
        {showPremiumModal && (
          <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50">
            <div className="bg-gradient-to-b from-gray-900 to-black rounded-lg w-full max-w-2xl border border-gray-700 shadow-2xl relative">
              {/* Close button */}
              <button
                onClick={() => setShowPremiumModal(false)}
                className="absolute top-2 right-2 text-white hover:text-gray-300 z-10"
              >
                <X size={24} />
              </button>

              {/* Header */}
              <div className="bg-gradient-to-r from-yellow-800 to-yellow-600 p-3 rounded-t-lg">
                <h2 className="text-xl font-bold text-center text-white">
                  EXCLUSIVE OFFERS
                </h2>
                <p className="text-sm text-center text-yellow-200">
                  New Bundles: {exclusiveOffersTime}
                </p>
              </div>

              <div className="p-4 flex flex-col md:flex-row gap-4">
                {/* Coin Purchase Section */}
                <div className="w-full md:w-1/3">
                  <div className="bg-gray-800 bg-opacity-60 p-3 rounded-lg mb-3">
                    <h3 className="text-center text-white font-bold mb-2">
                      Get PARMA Crates
                    </h3>

                    <div className="grid grid-cols-2 gap-2 mb-3">
                      <div className="bg-blue-900 border-2 border-blue-700 rounded p-2 text-center cursor-pointer hover:brightness-110">
                        <div className="flex justify-center items-center mb-1">
                          <img
                            src="/Better_Pass/images/imagegp.png"
                            alt="GP"
                            className="w-5 h-5 mr-1"
                          />
                          <span className="text-yellow-400 font-bold">3000</span>
                        </div>
                        <div className="bg-blue-600 rounded py-1 text-white font-bold">
                          $9.99
                        </div>
                      </div>

                      <div className="bg-blue-900 border-2 border-blue-700 rounded p-2 text-center cursor-pointer hover:brightness-110">
                        <div className="flex justify-center items-center mb-1">
                          <img
                            src="/Better_Pass/images/imagegp.png"
                            alt="GP"
                            className="w-5 h-5 mr-1"
                          />
                          <span className="text-yellow-400 font-bold">8300</span>
                        </div>
                        <div className="bg-blue-600 rounded py-1 text-white font-bold">
                          $24.99
                        </div>
                      </div>

                      <div className="bg-blue-900 border-2 border-blue-700 rounded p-2 text-center cursor-pointer hover:brightness-110">
                        <div className="flex justify-center items-center mb-1">
                          <img
                            src="/Better_Pass/images/imagegp.png"
                            alt="GP"
                            className="w-5 h-5 mr-1"
                          />
                          <span className="text-yellow-400 font-bold">
                            16000
                          </span>
                        </div>
                        <div className="bg-blue-600 rounded py-1 text-white font-bold">
                          $39.99
                        </div>
                      </div>

                      <div className="bg-blue-900 border-2 border-blue-700 rounded p-2 text-center cursor-pointer hover:brightness-110">
                        <div className="flex justify-center items-center mb-1">
                          <img
                            src="/Better_Pass/images/imagegp.png"
                            alt="GP"
                            className="w-5 h-5 mr-1"
                          />
                          <span className="text-yellow-400 font-bold">
                            53000
                          </span>
                        </div>
                        <div className="bg-blue-600 rounded py-1 text-white font-bold">
                          $99.99
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                {/* Battle Pass Section */}
                <div className="w-full md:w-1/3">
                  <div className="bg-gray-800 bg-opacity-60 p-3 rounded-lg mb-3">
                    <h3 className="text-center text-white font-bold mb-2">
                      Unlock ALL Items
                    </h3>
                    <div className="text-center text-yellow-300 text-sm">
                      Get instant access to all premium rewards!
                    </div>

                    <div className="mt-3 flex justify-center">
                      <button className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold py-2 px-4 rounded-lg">
                        UNLOCK ALL FOR $49.99
                      </button>
                    </div>
                  </div>
                </div>
                {/* Featured Item Section */}
                <div className="w-full md:w-1/3">
                  <div className="bg-gray-800 bg-opacity-60 p-3 rounded-lg mb-3">
                    <h3 className="text-center text-white font-bold mb-2">
                      Featured Item
                    </h3>{" "}
                    <div className="relative overflow-hidden rounded-md">
                      <img
                        src="/Better_Pass/images/image51.png"
                        alt="Featured Item"
                        className="w-full h-32 object-cover rounded-md"
                      />
                      <div className="absolute inset-0 bg-black opacity-20"></div>
                      <div className="absolute bottom-0 left-0 p-2 text-white">
                        <div className="font-bold">Legendary Skin</div>
                        <div className="text-sm">Limited Time Offer</div>
                      </div>
                    </div>

                    <div className="mt-3 flex justify-center">
                      <button className="bg-purple-500 hover:bg-purple-600 text-white font-bold py-2 px-4 rounded-lg">
                        GET IT NOW!
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              {/* Footer */}
              <div className="p-3 rounded-b-lg text-center">
                <p className="text-gray-400 text-xs">
                  &copy; 2025 SurvivX.io. All rights reserved.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Premium Bundles Modal */}
        {showBundleModal && (
          <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
            <div className="bg-gray-800 rounded-lg p-6w-[800px] max-w-[90%] relative">
              <button
                className="absolute top-2 right-2 text-gray-400 hover:text-white"
                onClick={() => {
                  setShowBundleModal(false);
                  closeShopMode();
                }}
              >
                <X size={24} />
              </button>
              <h2 className="text-2xl text-center mb-4 text-white">
                EXCLUSIVE OFFERS
              </h2>
              <p className="text-center text-yellow-400 mb-6">
                New Bundles: {shopBundleTime}
              </p>
              <div className="flex justify-center space-x-4 mb-4">
                <button
                  className="bg-purple-700 hover:bg-purple-800 px-4 py-1 rounded-md flex items-center"
                  onClick={handleBuyItemClick}
                >
                  BUY ITEM
                </button>
                <button
                  className="bg-purple-700 hover:bg-purple-800 px-4 py-1 rounded-md flex items-center"
                  onClick={handleSellItemClick}
                >
                  SELL ITEM
                </button>
              </div>

              {activeShopMode === "buy" && <BuyItems />}
              {activeShopMode === "sell" && <SellItems />}

              {activeShopMode === null && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Bundle 1 */}
                  <div className="border-2 border-purple-500 rounded-lg p-4 relative">
                    <div className="absolute -top-2 -left-2 bg-yellow-500 transform rotate-[-45deg] px-2 py-1 text-black font-bold">
                      5% OFF
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      {/* Use actual premium rewards here */}
                      <div className="border-2 border-green-500 p-2 flex justify-center items-center h-16">
                        <img
                          src={premiumPassRewards[0].image} // Premium Reward 1
                          alt="Premium Reward 1"
                          className="w-full h-full object-contain"
                        />
                      </div>
                      <div className="border-2border-teal-400 p-2 flex justify-center items-center h-16">
                        <img
                          src={premiumPassRewards[1].image} // Premium Reward 2
                          alt="Premium Reward 2"
                          className="w-full h-full object-contain"
                        />
                      </div>
                      <div className="border-2 border-purple-500 p-2 flex justify-center items-center h-16">
                        <img
                          src={premiumPassRewards[2].image} // Premium Reward 3
                          alt="Premium Reward 3"
                          className="w-full h-full object-contain"
                        />
                      </div>
                    </div>
                    <div className="mt-4 flex items-center justify-center">
                      <button className="flex items-center justify-center bg-gray-700 hover:bg-gray-600 rounded-md py-2 px-4">
                        <img
                          src="/Better_Pass/images/imagegp.png"
                          alt="GP"
                          className="w-5 h-5 mr-2"
                        />
                        <span className="text-yellow-400 font-bold">1111</span>
                      </button>
                    </div>
                  </div>

                  {/* Bundle 2 */}
                  <div className="border-2 border-purple-500 rounded-lg p-4 relative">
                    <div className="absolute -top-2 -left-2 bg-yellow-500 transform rotate-[-45deg] px-2 py-1 text-black font-bold">
                      10% OFF
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      {/* Use actual premium rewards here */}
                      <div className="border-2 border-green-500 p-2 flex justify-center items-center h-16">
                        <img
                          src={premiumPassRewards[3].image} // Premium Reward 4
                          alt="Premium Reward 4"
                          className="w-full h-full object-contain"
                        />
                      </div>
                      <div className="border-2 border-teal-400 p-2 flex justify-center items-center h-16">
                        <img
                          src={premiumPassRewards[4].image} // Premium Reward 5
                          alt="Premium Reward 5"
                          className="w-full h-full object-contain"
                        />
                      </div>
                      <div className="border-2 border-teal-400 p-2 flex justify-center items-center h-16">
                        <img
                          src={premiumPassRewards[5].image} // Premium Reward 6
                          alt="Premium Reward 6"
                          className="w-full h-full object-contain"
                        />
                      </div>
                      <div className="col-start-2 border-2 border-purple-500 p-2 flex justify-center items-center h-16">
                        <img
                          src={premiumPassRewards[6].image} // Premium Reward 7
                          alt="Premium Reward 7"
                          className="w-full h-full object-contain"
                        />
                      </div>
                    </div>
                    <div className="mt-4 flex items-center justify-center">
                      <button className="flex items-center justify-center bg-gray-700 hover:bg-gray-600 rounded-md py-2 px-4">
                        <img
                          src="/Better_Pass/images/imagegp.png"
                          alt="GP"
                          className="w-5 h-5 mr-2"
                        />
                        <span className="text-yellow-400 font-bold">1323</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Reward Details Modal */}
        {activeReward && (
          <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-40 backdrop-blur-sm">
            <div
              className={`bg-gradient-to-b from-gray-800 to-gray-900 rounded-lg p-6 max-w-md w-full border-2 ${getRarityBorder(
                activeReward.rarity,
              )} shadow-2xl relative`}
            >
              <button
                onClick={() => setActiveReward(null)}
                className="absolute top-2 right-2 text-gray-400 hover:text-white"
              >
                <X size={24} />
              </button>
              <img
                src={activeReward.image}
                alt="Reward Preview"
                className="w-full h-48 object-contain rounded-md mb-4"
              />
              <h3 className="text-xl font-bold text-white mb-2">
                Reward {activeReward.position}
              </h3>
              <p className="text-gray-300">
                Rarity:{" "}
                <span className={getRarityTextColor(activeReward.rarity)}>
                  {activeReward.rarity}
                </span>
              </p>
              <p className="text-gray-300">
                Type: <span>{activeReward.type}</span>
              </p>
              <button className="mt-4 w-full bg-green-500 hover:bg-green-600 text-white font-bold py-2 rounded">
                Claim Reward
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
const originalGameContainer = () => {
  return <div id="game-container"></div>;
};
// Main App Component from Better_Season_Pass

function App() {
  return <GameContainer />;
}

const rootElement = document.getElementById("root");
if (rootElement) {
  createRoot(rootElement).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}


  