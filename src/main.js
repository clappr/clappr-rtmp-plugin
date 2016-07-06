// Copyright 2014 Globo.com Player authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

import {Browser, Events, Flash, Mediator, Styler, UICorePlugin, template} from 'clappr'

import flashHTML from '../public/flash.html'
import flashStyle from '!raw!sass!../public/flash.scss'

export default class RTMP extends Flash {
    get name() { return 'rtmp' }
    get tagName() { return 'object' }
    get template() { return template(flashHTML) }
    get attributes() {
        return {
            'data-rtmp': '',
            'type': 'application/x-shockwave-flash',
            'width': '100%',
            'height': '100%'
        }
    }

    constructor(options) {
        super(options)
        this.options.rtmpConfig = this.options.rtmpConfig || {}
        this.options.rtmpConfig.swfPath = this.options.rtmpConfig.swfPath || '//cdn.jsdelivr.net/clappr.rtmp/latest/assets/RTMP.swf'
        this.options.rtmpConfig.wmode = this.options.rtmpConfig.wmode || 'transparent' // Default to transparent wmode - IE always uses gpu as per objectIE
        this.options.rtmpConfig.bufferTime = this.options.rtmpConfig.bufferTime === undefined ? 0.1 : this.options.rtmpConfig.bufferTime
        this.options.rtmpConfig.scaling = this.options.rtmpConfig.scaling || 'letterbox'
        this.options.rtmpConfig.playbackType = this.options.rtmpConfig.playbackType || this.options.src.indexOf('live') > -1
        this.options.rtmpConfig.startLevel = this.options.rtmpConfig.startLevel === undefined ? -1 : this.options.rtmpConfig.startLevel
        this._setupPlaybackType()
    }

    getPlaybackType() {
        return this._playbackType
    }

    get swfPath() {
        return this.options.rtmpConfig.swfPath
    }

    get currentLevel() {
        return this.el.getCurrentLevel();
    }

    get numLevels() {
        return this.el.getNumLevels();
    }


    set currentLevel(level) {
        this.el.setLevel(level);
    }

    get autoSwitchLevels() {
        return this.el.isAutoSwitchLevels();
    }

    get levels() {
        var levels = [];

        for (var i = 0; i < this.numLevels; i++) {
            var bitrate = this.el.getBitrateForLevel(i);

            levels.push({
                id: i,
                label: bitrate + "Kbps"
            });
        }

        return levels;
    }

    get isDynamicStream() {
        return this.el.isDynamicStream();
    }

    addListeners() {
        Mediator.on(this.uniqueId + ':progress', this._progress, this)
        Mediator.on(this.uniqueId + ':timeupdate', this._updateTime, this)
        Mediator.on(this.uniqueId + ':statechanged', this._checkState, this)
        Mediator.on(this.uniqueId + ':onloaded', this._reporLevels, this)
        Mediator.on(this.uniqueId + ':levelChanging', this._levelChanging, this)
        Mediator.on(this.uniqueId + ':levelChanged', this._levelChange, this)
        Mediator.on(this.uniqueId + ':flashready', this._bootstrap, this)
    }

    stopListening() {
        super.stopListening()
        Mediator.off(this.uniqueId + ':progress')
        Mediator.off(this.uniqueId + ':timeupdate')
        Mediator.off(this.uniqueId + ':statechanged')
        Mediator.off(this.uniqueId + ':flashready')
    }

    _bootstrap() {
        this.el.width = '100%'
        this.el.height = '100%'
        this.options.autoPlay && this.play()
        this._setupSettings()
    }

    _updateTime() {
        if (this.getPlaybackType() === 'live') {
            this.trigger(Events.PLAYBACK_TIMEUPDATE, {current: 1, total: 1}, this.name)
        } else {
            this.trigger(Events.PLAYBACK_TIMEUPDATE, {current: this.el.getPosition(), total: this.el.getDuration()}, this.name)
        }
    }

    _levelChanging() {
        this.trigger(Events.PLAYBACK_LEVEL_SWITCH_START)
    }

    _levelChange() {
        this.trigger(Events.PLAYBACK_LEVEL_SWITCH_END)
    }

    findLevelBy(id) {
        var foundLevel
        this.levels.forEach((level) => { if (level.id === id) {foundLevel = level} })
        return foundLevel
    }

    _setupPlaybackType() {
        this._playbackType = this.options.rtmpConfig.playbackType
    }

    _setupSettings() {
        if (this.getPlaybackType() === 'live') {
            this.settings.left = ["playpause"]
            this.settings.right = ["fullscreen", "volume"]
            this.settings.seekEnabled = false
        }
        else {
            this.settings.left = ["playpause", "position", "duration"]
            this.settings.right = ["fullscreen", "volume"]
        }

        this.trigger(Events.PLAYBACK_SETTINGSUPDATE, this.name)
    }

    render() {
        this.$el.html(this.template({ cid: this.cid, swfPath: this.swfPath, playbackId: this.uniqueId, wmode: this.options.rtmpConfig.wmode, scaling: this.options.rtmpConfig.scaling,
                                      bufferTime: this.options.rtmpConfig.bufferTime, playbackType: this.options.rtmpConfig.playbackType, startLevel: this.options.rtmpConfig.startLevel }))
        if (Browser.isIE) {
            this.$('embed').remove()
            if (Browser.isLegacyIE) {
                this.$el.attr('classid', IE_CLASSID)
            }
        } else if (Browser.isFirefox) {
            this._setupFirefox()
        }
        this.el.id = this.cid
        var style = Styler.getStyleFor(flashStyle)
        this.$el.append(style)
        return this
    }

    _checkState() {
        super._checkState()

        if (this.el.getState() === "PLAYING") {
            this.trigger(Events.PLAYBACK_PLAY, this.name)
        } else if (this.el.getState() === "PLAYING_BUFFERING") {
            if (this._isReadyState === false) {
                this._isReadyState = true
                this.trigger(Events.PLAYBACK_READY, this.name)
            }
        } else if (this.el.getState() === "ERROR") {
            this.trigger(Events.PLAYBACK_ERROR, this.name)
        }
    }

    _reporLevels() {
        if (this.isDynamicStream) {
            if (this.levels) {
                this.trigger(Events.PLAYBACK_LEVELS_AVAILABLE, this.levels, this.options.rtmpConfig.startLevel)
            }
        }
    }
}

RTMP.canPlay = function (source) {
    return !!((source.indexOf('rtmp://') > -1 || source.indexOf('.smil') > -1) && Browser.hasFlash)
};

RTMP.debug = s => console.log(s)
