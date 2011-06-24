var syncpadIDs = ["kpjkeokciebpooppmpmmiooaekoijlpp","djiafihgcdhojlgmgfolclfgmllnhhbj"];
var syncpadID;
var syncpadVersion;

var thisManifest;

function skipUrl(url,notify){
	if((url.indexOf('http://') != 0 && url.indexOf('https://') != 0 ) || url.indexOf('https://chrome.google.com/') == 0){
            if(notify)
                alert('Sorry, but because of Google Chrome policy, Webnotes can\'t work on this page.');
            return
                true;
	} else
            return false;
}

chrome.browserAction.setBadgeText({text:""});
chrome.browserAction.setBadgeBackgroundColor({color:[0,0,255,128]});

chrome.browserAction.onClicked.addListener(function(tab) {
        console.log("action clicked")
        if(skipUrl(tab.url,true))
            return;
        
        if (!syncpadID)
            promptSyncpadInstall();
        

        requestSyncpad({action:"have_credentials"}, function(have_credentials) {
            if (have_credentials)
                newNote(tab);
        });
            
});

chrome.tabs.onUpdated.addListener(function(tabId,changeInfo,tab) {
        console.log("changed tab %s, status = %s",tab.url, changeInfo.status)
        if (changeInfo.status == "complete")
            if(!skipUrl(tab.url)){
                    //loadCSS();
                    loadNotes(tab);
            }
	//updateCount(tab);
});

var newNote =  function(tab) {
    chrome.tabs.sendRequest(tab.id, {action: "new"});
};

var loadNotes = function(tab) {
    console.log("loadNotes")
    getTabNotes(tab, function(notes) {
                console.log("got %i notes for %s",notes.length, tab.url);
                chrome.tabs.sendRequest(tab.id, {action:"loadnotes", notes: notes});
            });
}

// Content scripts listener
chrome.extension.onRequest.addListener(function(request, sender, response) {
    console.log("request.action = %s", request.action)
    if (request.method == "relaytosyncpad") {
        delete request.method;
        requestSyncpad(request, response);
    } else if (request.action == "updatecount"){
        chrome.tabs.getSelected(null,function(tab) {
            getTabNotes(tab);
        });
    } else if (request.action == "querysyncpad")
        response(syncpadID != undefined);
})

// Syncpad listener
chrome.extension.onRequestExternal.addListener(function(request, sender, response) {        
    if (syncpadIDs.indexOf(sender.id)<0) {
        console.log("unauthorized external request from " + sender.id);
        return;
    } else
        console.log("syncpad request %s from %s",request.action, sender.id);
    
    switch(request.action) {
        case "new":
            chrome.tabs.getSelected(null,function(tab) {
                if(!skipUrl(tab.url,true)){
                    newNote(tab);
                    response(true);
                } else
                    response(false);
            });
            break;
    }
});

function noteCount(tabid, n) {
    if (n>0)
        chrome.browserAction.setBadgeText({text:""+n,tabId:tabid});
    else
        chrome.browserAction.setBadgeText({text:"",tabId:tabid});
}

function requestSyncpad(request,response) {

    registerPlugin();

    if (syncpadID == undefined) {
        if (!localStorage.asksyncpad)
            promptSyncpadInstall();
        localStorage.asksyncpad = "false";
        return;
    }
    chrome.extension.sendRequest(syncpadID,request,response);
}

function getTabNotes(tab, callback) {
    var reg = "^SYNCPADWEBNOTE\\[(" + RegExp.escape(removeAnchor(tab.url)) + "),(\\d+px),(\\d+px),(\\d+px)?,(\\d+px)?\\]$";
    
    requestSyncpad({ action:"getnotes", deleted:0, regex: reg}, function(notes) {
        noteCount(tab.id,notes.length);
        if (callback)
            callback(notes);
    });
}

function promptSyncpadInstall() {
    var c = confirm("Syncpad could not be found. If you are sure that it is installed, please restart Chrome.\n\nOpen Syncpad download page?");
    if (c)
        chrome.tabs.create({url:"https://chrome.google.com/webstore/detail/djiafihgcdhojlgmgfolclfgmllnhhbj"});    
}

function registerPlugin() {
    if (syncpadID != undefined)
        return;
    
    for (var i=0; i<syncpadIDs.length; i++)
        (function (id) {
            chrome.extension.sendRequest(id,{action:"register_plugin", name:"webnotes", syncpad_id: id, version: thisManifest.version}, function(syncpadData) {
            if (!syncpadData)
                console.log("syncpad %s not found", id);
            else if (syncpadData.version >= "1.8") {
                console.log("found syncpad %s, version %s", syncpadData.syncpad_id, syncpadData.version);
                if (!syncpadVersion || syncpadData.version > syncpadVersion) {
                    syncpadID = syncpadData.syncpad_id;
                    syncpadVersion = syncpadData.version;
                    console.log("using this");
                } else
                    console.log("not using this");
            } else
                console.log("found syncpad %s, but version %s too low", syncpadData.syncpadID, syncpadData.version);
            });
        })(syncpadIDs[i]);
}

// parseUri 1.2.2
// (c) Steven Levithan <stevenlevithan.com>
// MIT License

function parseUri (str) {
	var	o   = parseUri.options,
		m   = o.parser[o.strictMode ? "strict" : "loose"].exec(str),
		uri = {},
		i   = 14;

	while (i--) uri[o.key[i]] = m[i] || "";

	uri[o.q.name] = {};
	uri[o.key[12]].replace(o.q.parser, function ($0, $1, $2) {
		if ($1) uri[o.q.name][$1] = $2;
	});

	return uri;
};

parseUri.options = {
	strictMode: false,
	key: ["source","protocol","authority","userInfo","user","password","host","port","relative","path","directory","file","query","anchor"],
	q:   {
		name:   "queryKey",
		parser: /(?:^|&)([^&=]*)=?([^&]*)/g
	},
	parser: {
		strict: /^(?:([^:\/?#]+):)?(?:\/\/((?:(([^:@]*)(?::([^:@]*))?)?@)?([^:\/?#]*)(?::(\d*))?))?((((?:[^?#\/]*\/)*)([^?#]*))(?:\?([^#]*))?(?:#(.*))?)/,
		loose:  /^(?:(?![^:@]+:[^:@\/]*@)([^:\/?#.]+):)?(?:\/\/)?((?:(([^:@]*)(?::([^:@]*))?)?@)?([^:\/?#]*)(?::(\d*))?)(((\/(?:[^?#](?![^?#\/]*\.[^?#\/.]+(?:[?#]|$)))*\/?)?([^?#\/]*))(?:\?([^#]*))?(?:#(.*))?)/
	}
};

RegExp.escape = function(text) {
    return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
}

function removeAnchor(url) {
    var uriInfo = parseUri(url);
    return url.substr(0,url.length - (uriInfo.anchor.length>0 && uriInfo.anchor.indexOf("/") < 0?uriInfo.anchor.length+1:0));
}

function get_manifest(callback) {
  var xhr = new XMLHttpRequest();
  xhr.onload = function () {
    callback(JSON.parse(xhr.responseText));
  };
  xhr.open('GET', '../manifest.json', true);
  xhr.send(null);
}

// on page load, register plugin
setTimeout(function() {
        get_manifest(function (mf) {
            thisManifest = mf;
            registerPlugin();
        });
    },500);
//parseUri("https://code.google.com/chrome/extensions/extension.html#method-sendRequest")
//Object
//anchor: "method-sendRequest"
//authority: "code.google.com"
//directory: "/chrome/extensions/"
//file: "extension.html"
//host: "code.google.com"
//password: ""
//path: "/chrome/extensions/extension.html"
//port: ""
//protocol: "https"
//query: ""
//queryKey: Object
//relative: "/chrome/extensions/extension.html#method-sendRequest"
//source: "https://code.google.com/chrome/extensions/extension.html#method-sendRequest"
//user: ""
//userInfo: ""
//__proto__: Object