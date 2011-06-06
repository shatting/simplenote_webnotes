var syncpadIDs = ["eapgnfmlgmaihbmdmeecijoijlhfhaaj","djiafihgcdhojlgmgfolclfgmllnhhbj"];
var syncpadID;

function skipUrl(url,notify){
	if((url.indexOf('http://') != 0 && url.indexOf('https://') != 0 ) || url.indexOf('https://chrome.google.com/') == 0){
            if(notify)
                alert('Google Chrome has restricted to use of plugins in this page!');
            return
                true;
	} else
            return false;
}

chrome.browserAction.setBadgeText({text:""});

chrome.browserAction.onClicked.addListener(function(tab) {
        console.log("action clicked")
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
    if(!skipUrl(tab.url,true))
        chrome.tabs.sendRequest(tab.id, {action: "new"});
};

var loadNotes = function(tab) {
    console.log("loadNotes")
     requestSyncpad( { action:"getnotes", deleted:0, contentquery:"SYNCPADWEBNOTE[" + tab.url }, function(notes) {
                console.log("got %i notes for %s",notes.length, tab.url);
                chrome.tabs.sendRequest(tab.id, {action:"loadnotes", notes: notes});
                chrome.browserAction.setBadgeText({text:""+notes.length,tabId:tab.id});
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
            requestSyncpad({ action:"getnotes", deleted:0, contentquery:"SYNCPADWEBNOTE[" + tab.url }, function(notes) {
                    console.log("got %i notes for %s",notes.length, tab.url);
                    chrome.browserAction.setBadgeText({text:""+notes.length,tabId:tab.id});
                });
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
        console.log("external request %s from %s",request.action, sender.id);
    
    switch(request.action) {
        case "new":
            chrome.tabs.getSelected(null,function(tab) {
                newNote(tab);
                response(true);
            });
            break;
    }
});

function requestSyncpad(request,response) {
    if (syncpadID == undefined) {
        if (!localstorage.asksyncpad)
            promptSyncpadInstall();
        localstorage.asksyncpad = "false";
        return;
    }
    chrome.extension.sendRequest(syncpadID,request,response);
}

function promptSyncpadInstall() {
    var c = confirm("Syncpad is required, but not installed or outdated.\n\nOpen extension download page?");
    if (c)
        chrome.tabs.create({url:"https://chrome.google.com/webstore/detail/djiafihgcdhojlgmgfolclfgmllnhhbj"});    
}

// register plugin
for (var i=0; i<syncpadIDs.length; i++)
    chrome.extension.sendRequest(syncpadIDs[i],{action:"register_plugin", name:"webnotes", syncpad_id: syncpadIDs[i]}, function(syncpadData) {
        
        if (syncpadData.version >= "1.8") {
            console.log("found syncpad %s, version %s", syncpadData.syncpad_id, syncpadData.version);
            syncpadID = syncpadData.syncpad_id;
        } else
            console.log("found syncpad %s, but version %s too low", syncpadData.syncpadID, syncpadData.version);
    });