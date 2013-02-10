// ==UserScript==
// @name         OGame Hidden Colony
// @description  Shows you the update timestamp of the planet APIs, helping you to make a hidden colony to hide your activity.
// @namespace    http://userscripts.org/users/68563/scripts
// @downloadURL  https://userscripts.org/scripts/source/158801.user.js
// @updateURL    https://userscripts.org/scripts/source/158801.meta.js
// @version      0.2
// @include      *://*.ogame.*/game/index.php?*page=*
// ==/UserScript==
/*! OGame Hidden Colony (C) 2012 Elías Grande Cásedas | GNU-GPL | gnu.org/licenses */
(function(){
////////////

var win = window, doc;
try{if (unsafeWindow) win = unsafeWindow;}
catch(e){}
doc = win.document;

/**
 * ID prefix to avoid conflicts with other tools.
 */
const IDP = /*[IDP]*/'o_hidden_colony_'/*[/IDP]*/;

/**
 * Minimum time between API requests (seconds).
 */
const MIN_DELAY = 10;

/**
 * List of tools which use each API.
 */
var API_TOOLS = {
	UNIVERSE : [
		{NAME : 'AntigameOrigin', URL : 'antigame.de'},
		{NAME : 'Ogniter', URL : 'www.ogniter.org'}
	],
	PLAYER_DATA : [
		{NAME : 'GalaxyInfo', URL : 'userscripts.org/scripts/show/136509'}
	]
}

/**
 * Templates for API URLs.
 */
var API_URL_TPLS = {
	UNIVERSE    : '{uni}/api/universe.xml',
	PLAYER_DATA : '{uni}/api/playerData.xml?id={pid}'
}

/*
 * Recursively merge properties of two objects.
 */
var deepMerge = function (to, from) {
	for (var attrname in from) {
		if (!from.hasOwnProperty(attrname)) continue;
		if (from[attrname].constructor == Object) {
			if (!to.hasOwnProperty(attrname)) to[attrname] = {};
			to[attrname] = deepMerge (to[attrname], from[attrname]);
		}
		else
			to[attrname] = from[attrname];
	}
	return to;
}

/*
 * Transform a GMT Date String into a timestamp number.
 */
var gmtDateStringToTimestamp = function (strDate) {
	return Math.round((new Date(strDate)).getTime()/1000);
}

/**
 * DAO for reading the objects from the DOM.
 */
var DomDao = function () {

	//// Some useful metas ////
	
	this._universe = this.getMeta('universe').trim();
	this._playerId = parseInt(this.getMeta('player-id'));
	this._timestamp = parseInt(this.getMeta('timestamp'));
	this._language = this.getMeta('language').trim();
	
	//// GMT zone of the server (in minutes) ////
	
	// locTime: seconds from 00:00:00 in localized time (from top-right clock)
	var locTime = this.query('.OGameClock span').childNodes[0].nodeValue;
	locTime = locTime.replace(/^\D+/,'').replace(/\D+$/,'').split(/\D/);
	locTime = parseInt(locTime[0])*3600 + parseInt(locTime[1])*60 +
			parseInt(locTime[2]);
	// gmtTime: seconds from 00:00:00 in GMT time
	var gmtTime = this._timestamp;
	gmtTime = gmtTime/86400;
	gmtTime = Math.round((gmtTime-Math.floor(gmtTime))*86400);
	// compare them in minutes to avoid loading problems
	var gmtOffset = Math.round((locTime-gmtTime)/60);
	// beware limits: e.g. local 00:00 gmt 23:00
	if (gmtOffset < (-720))
		gmtOffset = gmtOffset + 1440;
	// beware limits: e.g. local 23:00 gmt 00:00
	else if (gmtOffset > 720)
		gmtOffset = gmtOffset - 1440;
	this._gmtOffset = gmtOffset;
}
DomDao.prototype = {
	query : function (selector) {
		return doc.querySelector(selector);
	},
	getMeta : function (name) {
		return this.query('meta[name="ogame-'+name+'"]'
				).getAttribute('content');
	},
	getUniverse  : function () {return this._universe;},
	getPlayerId  : function () {return this._playerId;},
	getTimestamp : function () {return this._timestamp;},
	getLanguage  : function () {return this._language;},
	getGmtOffset : function () {return this._gmtOffset;}
}

/**
 * Convert timestamps into readable format.
 */
var DateFormat = function (gmtOffset) {
	var aux = new Date();
	this._offset = (gmtOffset+aux.getTimezoneOffset())*60;
}
DateFormat.prototype = {
	timestampToLocaleString : function (timestamp) {
		var date = new Date (timestamp*1000);
		var hours = date.getHours();
		if (hours < 10) hours = '0'+hours.toString();
		var minutes = date.getMinutes();
		if (minutes < 10) minutes = '0'+minutes.toString();
		var seconds = date.getSeconds();
		if (seconds < 10) seconds = '0'+seconds.toString();
		return date.toLocaleDateString() + ' ' +
				hours + ':' + minutes + ':' + seconds;
	},
	timestampToOgameString : function (timestamp) {
		return this.timestampToLocaleString(timestamp+this._offset);
	},
	countdownCompleted : '00:00:00',
	timestampToCountdownString : function (timestamp) {
		var timeleft = Math.round(
				(timestamp*1000 - (new Date()).getTime())/1000);
		if (timeleft < 0)
			return this.countdownCompleted;
		var hours = Math.floor(timeleft/3600);
		timeleft = timeleft - hours*3600;
		var minutes = Math.floor(timeleft/60);
		var seconds = timeleft - minutes*60;
		return ((hours<10)?'0':'') + hours.toString() + ':' +
				((minutes<10)?'0':'') + minutes.toString() + ':' +
				((seconds<10)?'0':'') + seconds.toString();
	},
	initCountdown : function (textNode, timestamp) {
		var node = textNode;
		var time = timestamp;
		var dateFormat = this;
		var interval;
		var updateCountdown = function () {
			node.nodeValue = dateFormat.timestampToCountdownString (time);
			if (node.nodeValue == dateFormat.countdownCompleted)
				clearInterval (interval);
		}
		interval = setInterval(updateCountdown,1000);
	}
}

/**
 * DAO for saving/loading data using the local storage.
 */
var StorageDao = function (domDao) {
	this._prefix = IDP + domDao.getUniverse() + '_';
}
StorageDao.prototype =
{
	_obj : win.localStorage,
	get : function (id) {
		var value = this._obj.getItem (this._prefix + id);
		return (value == null) ? null : JSON.parse (value);
	},
	set : function (id, data) {
		return this._obj.setItem (this._prefix + id, JSON.stringify(data));
	},
	remove : function (id) {
		return this._obj.removeItem (this._prefix + id);
	}
}

/**
 * DAO for reading the headers stored in the local storage.
 */
var ApiStorageDao = function (storageDao, id) {
	this._headers = storageDao.get(id);
}
ApiStorageDao.prototype = {
	getHeaders : function (callback) {
		callback (this._headers);
	},
	needUpdate : function (currentTimestamp) {
		/*[test]* / return true /*[/test]*/
		try {
			if (this._headers == null)
				return true;
			var expiresTimestamp = this._headers.expires;
			var lastCheckTimestamp = this._headers.date;
			return (
				(expiresTimestamp < currentTimestamp) &&
				(lastCheckTimestamp + MIN_DELAY < currentTimestamp)
			) ? true : false;
		}
		catch (e) {
			return true;
		}
	}
}

/**
 * DAO for requesting the headers from a remote url.
 * It also saves the new headers into the local storage.
 */
var ApiAjaxDao = function (storage, id, domDao, url) {
	this._url = url;
	this._storage = storage;
	this._id = id;
	this._domDao = domDao;
	this._headers = null;
}
ApiAjaxDao.prototype =
{
	getHeaders : function (callback) {
		if (this._headers != null) {
			callback(this._headers);
			return;
		}
		var _this = this;
		var xhr = new XMLHttpRequest();
		xhr.open ('HEAD', 'http://' + _this._url);
		xhr.onreadystatechange = function() {
			if (this.readyState == this.DONE) {
				_this._headers = {
					expires       : gmtDateStringToTimestamp(
							this.getResponseHeader("Expires")),
					lastModified  : gmtDateStringToTimestamp(
							this.getResponseHeader("Last-Modified")),
					date          : _this._domDao.getTimestamp()
				};
				_this._storage.set(_this._id, _this._headers);
				callback (_this._headers);
			}
		};
		xhr.send();
	}
}

/**
 * DAO which uses the previous DAOs to get and save the headers.
 * It also build the api URLs using the API_URL_TPLS templates.
 */
var ApiDao = function (domDao, storage) {
	this._universeUrl = API_URL_TPLS.UNIVERSE.replace(
			'{uni}',domDao.getUniverse());
	this._playerDataUrl = API_URL_TPLS.PLAYER_DATA.replace(
			'{uni}',domDao.getUniverse()).replace(
			'{pid}',domDao.getPlayerId());

	this._universeDao   = new ApiStorageDao (storage, 'universe');
	this._playerDataDao = new ApiStorageDao (storage, 'playerData');
	
	var currentTimestamp = domDao.getTimestamp();
	
	if (this._universeDao.needUpdate(currentTimestamp))
		this._universeDao = new ApiAjaxDao (
				storage, 'universe', domDao, this.getUniverseUrl());

	if (this._playerDataDao.needUpdate(currentTimestamp))
		this._playerDataDao = new ApiAjaxDao (
				storage, 'playerData', domDao, this.getPlayerDataUrl());
}
ApiDao.prototype = {
	getUniverseUrl : function () {
		return this._universeUrl;
	},
	getPlayerDataUrl : function () {
		return this._playerDataUrl;
	},
	getUniverseHeaders : function (callback) {
		this._universeDao.getHeaders (callback);
	},
	getPlayerDataHeaders : function (callback) {
		this._playerDataDao.getHeaders (callback);
	}
}

/*
 * Builds the translation map.
 */
var I18nMap = function (lang) {
	/*! [i18n] en_GB */
	deepMerge (this,{
		TITLE   : 'HiddenColony',
		API     : 'API',
		USED_BY : 'Used by',
		LAS_MOD : 'Last update',
		EXPIRES : 'Next update',
		SER_TIM : 'Server time',
		LOC_TIM : 'Local time',
		REM_TIM : 'Remaining time'
	});
	/*! [i18n] es_ES */
	if (/es|ar|mx/.test(lang)) deepMerge (this,{
		USED_BY : 'Usado por',
		LAS_MOD : 'Última actualización',
		EXPIRES : 'Próxima actualización',
		SER_TIM : 'Hora del servidor',
		LOC_TIM : 'Hora local',
		REM_TIM : 'Tiempo restante'
	});
}

var MenuButton = function (menu, title, action) {
	var row, link, label, text;
	// row
	row = doc.createElement ('li');
	// link
	link = doc.createElement ('a');
	link.setAttribute ('href', 'javascript:void(0)');
	link.setAttribute ('class', 'menubutton');
	link.addEventListener ('click', action, false);
	// label
	label = doc.createElement ('span');
	label.setAttribute ('class', 'textlabel');
	// text node
	text = doc.createTextNode (title);
	// build
	menu.appendChild (row);
	row.appendChild (link);
	link.appendChild (label);
	label.appendChild (text);
}

var UiBuilder = function (i18n, dateFormat, apiDao) {
	this._i18n = i18n;
	this._dateFormat = dateFormat;
	this._apiDao = apiDao;
	var _this = this;
	this._menuButton = new MenuButton (doc.querySelector('#menuTableTools'),
			i18n.TITLE, function(){_this.toggleWindow();} );
	this._universe = null;
	this._playerData = null;
}
UiBuilder.prototype = {
	toggleWindow : function () {
		var uni = this._universe;
		var pla = this._playerData;
		var df = this._dateFormat;
		var i18n = this._i18n;
		alert(
			i18n.API + ': ' + uni.url + "\n" +
			i18n.USED_BY + ': ' + API_TOOLS.UNIVERSE[0].NAME + "\n" +
			"\n" +
			/*i18n.LAS_MOD + ":\n" +
			"\t" + df.timestampToOgameString  (uni.lastModified) + ' (' + i18n.SER_TIM + ")\n" +
			"\t" + df.timestampToLocaleString (uni.lastModified) + ' (' + i18n.LOC_TIM  + ")\n" +*/
			i18n.EXPIRES + ":\n" +
			"\t" + df.timestampToOgameString  (uni.expires) + ' (' + i18n.SER_TIM + ")\n" +
			"\t" + df.timestampToLocaleString (uni.expires) + ' (' + i18n.LOC_TIM  + ")\n" +
			i18n.REM_TIM + ":\n" +
			"\t" + df.timestampToCountdownString (uni.expires) + "\n" +
			"\n" +
			"\n" +
			i18n.API + ': ' + pla.url + "\n" +
			i18n.USED_BY + ': ' + API_TOOLS.PLAYER_DATA[0].NAME + "\n" +
			"\n" +
			/*i18n.LAS_MOD + ":\n" +
			"\t" + df.timestampToOgameString  (pla.lastModified) + ' (' + i18n.SER_TIM + ")\n" +
			"\t" + df.timestampToLocaleString (pla.lastModified) + ' (' + i18n.LOC_TIM  + ")\n" +*/
			i18n.EXPIRES + ":\n" +
			"\t" + df.timestampToOgameString  (pla.expires) + ' (' + i18n.SER_TIM + ")\n" +
			"\t" + df.timestampToLocaleString (pla.expires) + ' (' + i18n.LOC_TIM  + ")\n" +
			i18n.REM_TIM + ":\n" +
			"\t" + df.timestampToCountdownString (pla.expires) + "\n"
		);
	},
	setInfo : function (prop, url, headers) {
		this['_'+prop] = deepMerge({url:url}, headers);
	},
	setUniverse : function (url, headers) {
		this.setInfo ('universe', url, headers);
	},
	setPlayerData : function (url, headers) {
		this.setInfo ('playerData', url, headers);
	}
}

/*
 * Do stuff on DOM content loaded.
 */
var onDOMContentLoaded = function() {
	var domDao = new DomDao ();
	var storageDao = new StorageDao (domDao);
	var apiDao = new ApiDao (domDao, storageDao);
	var i18n = new I18nMap (domDao.getLanguage());
	var dateFormat = new DateFormat (domDao.getGmtOffset());
	var uiBuilder = new UiBuilder (i18n, dateFormat, apiDao);
	
	/*var logHeaders = function (url, headers) {
		win.console.log('##############');
		win.console.log('URL           : '+url);
		win.console.log('--------------');
		win.console.log('Date          : '+dateFormat.timestampToOgameString(headers.date)+' (Server Time)');
		win.console.log('Expires       : '+dateFormat.timestampToOgameString(headers.expires)+' (Server Time)');
		win.console.log('Last-Modified : '+dateFormat.timestampToOgameString(headers.lastModified)+' (Server Time)');
		win.console.log('--------------');
		win.console.log('Date          : '+dateFormat.timestampToLocaleString(headers.date)+' (Local Time)');
		win.console.log('Expires       : '+dateFormat.timestampToLocaleString(headers.expires)+' (Local Time)');
		win.console.log('Last-Modified : '+dateFormat.timestampToLocaleString(headers.lastModified)+' (Local Time)');
	}*/
	
	apiDao.getUniverseHeaders(function(headers){
		uiBuilder.setUniverse(apiDao.getUniverseUrl(),headers);
	});
	apiDao.getPlayerDataHeaders(function(headers){
		uiBuilder.setPlayerData(apiDao.getPlayerDataUrl(),headers);
	});
}

/*
 * Bind the function "onDOMContentLoaded" to the "onDOMContentLoaded" event.
 */
var addOnDOMContentLoadedListener = function () {
	/*! [onDOMContentLoaded] by Dean Edwards & Matthias Miller & John Resig */
	var initTimer;
	var init = function() {
		// quit if this function has already been called
		if (arguments.callee.done) return;
		arguments.callee.done = true;
		// kill the timer
		if (initTimer) clearInterval(initTimer);
		// do stuff
		onDOMContentLoaded();
	};

	// for Mozilla/Opera9
	if (doc.addEventListener)
		doc.addEventListener("DOMContentLoaded", init, false);

	// for Safari
	if (/WebKit/i.test(win.navigator.userAgent)) { // sniff
		initTimer = setInterval(
				function() {
					if (/loaded|complete/.test(doc.readyState))
						init(); // call the onload handler
				}, 10);
	}

	// for other browsers
	win.onload = init;
}
addOnDOMContentLoadedListener();

/////
})();
