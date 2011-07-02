var captured = null;
var highestZ = 0;
var thisPageNotes = [];

function getHighestZindex(){
   var highestIndex = 0;
   var currentIndex = 0;
   var elArray = Array();
   elArray = document.getElementsByTagName('*');
   for(var i=0; i < elArray.length; i++){
      if (elArray[i].currentStyle){
         currentIndex = parseFloat(elArray[i].currentStyle['zIndex']);
      }else if(window.getComputedStyle){
         currentIndex = parseFloat(document.defaultView.getComputedStyle(elArray[i],null).getPropertyValue('z-index'));
      }
      if(!isNaN(currentIndex) && currentIndex > highestIndex){ highestIndex = currentIndex; }
   }
   return(highestIndex);
}

highestZ = getHighestZindex();

function Note()
{
    var self = this;

    var note = document.createElement('div');
    note.className = 'syncpad-webnote';
    //note.addEventListener('mousedown', function(e) { return self.onMouseDown(e) }, false);
    note.addEventListener('click', function() { return self.onNoteClick() }, false);
    this.note = note;

    var close = document.createElement('div');
    close.className = 'closebutton';
    close.addEventListener('click', function(event) { return self.close(event) }, false);
    note.appendChild(close);

    var edit = document.createElement('textarea');
    edit.className = 'edit';
    //edit.setAttribute('contenteditable', true);
    edit.setAttribute('spellcheck',false);
    edit.addEventListener('keyup', function() { return self.onKeyUp() }, false);
    note.appendChild(edit);
    this.editField = edit;

    var ts = document.createElement('div');
    ts.className = 'timestamp';
    ts.addEventListener('mousedown', function(e) { return self.onMouseDown(e) }, false);
    ts.innerHTML = "&nbsp;";
    note.appendChild(ts);
    this.lastModified = ts;
    
    var sy = document.createElement('div');
    sy.className = 'syncicon';
    sy.innerHTML = "&nbsp;";
    sy.addEventListener('mousedown', function(e) { return self.onMouseDown(e) }, false);
    note.appendChild(sy);
    this.syncIcon = sy;
    
    document.body.appendChild(note);
    thisPageNotes.push(note);
    return this;
}

Note.prototype = {
    get rawnote()
    {
        return this._note;
    },

    set rawnote(x)
    {
        this._note = x;
        console.log(x)
        this.timestamp = x.modifydate*1000;
    },

    get text()
    {
        return this.editField.value;
    },

    set text(x)
    {
        this.editField.value = x;
    },

    get timestamp()
    {
        return this._note.modifydate*1000;
    },

    set timestamp(x)
    {
        if (this._timestamp == x)
            return;

        this._timestamp = x;
        var date = new Date();
        date.setTime(parseFloat(x));
        this.lastModified.textContent = modifiedString(date);
    },

    get left()
    {
        return this.note.style.left;
    },

    set left(x)
    {
        this.note.style.left = x;
    },

    get top()
    {
        return this.note.style.top;
    },

    set top(x)
    {
        this.note.style.top = x;
    },

    get width()
    {
        return this.editField.style.width;
    },

    set width(x)
    {
        this.editField.style.width = x;
    },

    get height()
    {        
        return this.editField.style.height;
    },

    set height(x)
    {
        this.editField.style.height = x;
    },

    get zIndex()
    {
        return this.note.style.zIndex;
    },

    set zIndex(x)
    {
        this.note.style.zIndex = x;
    },

    close: function(event)
    {
        this.cancelPendingSave();       
       
        var duration = event.shiftKey ? 2 : .25;
        this.note.style.webkitTransition = '-webkit-transform ' + duration + 's ease-in, opacity ' + duration + 's ease-in';
        this.note.offsetTop; // Force style recalc
        this.note.style.webkitTransformOrigin = "0 0";
        this.note.style.webkitTransform = 'skew(30deg, 0deg) scale(0)';
        this.note.style.opacity = '0';

        if (this.rawnote)
            chrome.extension.sendRequest({method:"relaytosyncpad", action:"update", key:this.rawnote.key, deleted:1}, function() {
                chrome.extension.sendRequest({action:"updatecount"});
            });

        var self = this;
        setTimeout(function() { document.body.removeChild(self.note); thisPageNotes.splice(thisPageNotes.indexOf(self.note),1); }, duration * 1000);
        
    },

    saveSoon: function()
    {
        this.cancelPendingSave();
        var self = this;
        this._saveTimer = setTimeout(function() { self.save() }, 800);
    },

    cancelPendingSave: function()
    {
        if (!("_saveTimer" in this))
            return;
        clearTimeout(this._saveTimer);
        delete this._saveTimer;
    },

    save: function()
    {
        this.cancelPendingSave();

        if ("dirty" in this) {
            delete this.dirty;
        }        

        var requestData = {
            content: this.text + "\nSYNCPADWEBNOTE[" +  removeAnchor(location.href) + "," + this.left + "," + this.top  + "," + this.width + "," + this.height + "]",
            action : this.rawnote?"update":"create",
            key: this.rawnote?this.rawnote.key:"",
            method: "relaytosyncpad"
        }
        if (!this.rawnote)
            requestData.tags = ["Webnotes"];
                 
        this.syncIcon.style.backgroundImage = "url(" + chrome.extension.getURL("img/webnote_sync_dunkel.png") +")";

        var that = this;

        chrome.extension.sendRequest(requestData, function(newnote) {
                if (!that.rawnote) {
                    that.rawnote = newnote;
                    chrome.extension.sendRequest({action:"updatecount"});
                }                
                that.syncIcon.style.backgroundImage = "";                
            });

    },

    onMouseDown: function(e)
    {
        captured = this;
        this.startX = e.clientX - this.note.offsetLeft;
        this.startY = e.clientY - this.note.offsetTop;
        this.zIndex = ++highestZ;

        var self = this;
        if (!("mouseMoveHandler" in this)) {
            this.mouseMoveHandler = function(e) { return self.onMouseMove(e) }
            this.mouseUpHandler = function(e) { return self.onMouseUp(e) }
        }

        document.addEventListener('mousemove', this.mouseMoveHandler, true);
        document.addEventListener('mouseup', this.mouseUpHandler, true);

        return false;
    },

    onMouseMove: function(e)
    {
        if (this != captured)
            return true;

        this.left = e.clientX - this.startX + 'px';
        this.top = e.clientY - this.startY + 'px';
        return false;
    },

    onMouseUp: function(e)
    {
        document.removeEventListener('mousemove', this.mouseMoveHandler, true);
        document.removeEventListener('mouseup', this.mouseUpHandler, true);

        this.saveSoon();
        return false;
    },

    onNoteClick: function(e)
    {
        this.editField.focus();
        //getSelection().collapseToEnd();
    },

    onKeyUp: function()
    {
        this.dirty = true;
        this.saveSoon();
    }
}


function loadNotes(notes)
{
    console.log("got %i notes for page",notes.length)
    
    for (var i = 0; i < thisPageNotes.length; ++i) {
        try {
            document.body.removeChild(thisPageNotes[i]);
        } catch (e) {
            
        }
    }
    thisPageNotes = [];

    for (var i = 0; i < notes.length; ++i) {
            var notedata = notes[i];

            var note = new Note();
            
                 
            var lines = notedata.content.split("\n");

            var reg = new RegExp("^SYNCPADWEBNOTE\\[(" + RegExp.escape(removeAnchor(location.href)) + "),(\\d+px),(\\d+px),(\\d+px)?,(\\d+px)?\\]$","m");
            var left, top, width, height;

            var content = lines.filter(function(s,i) {
                var m = s.match(reg);
                if (m) {
                    left=m[2]; top=m[3]; width=m[4]; height=m[5];

                    return false;
                }
                return true;
                }).join("\n");

            console.log(content);
            console.log(left)
            console.log(top)
            console.log(width)
            console.log(height)
            
            note.text = content;

            note.left = left;
            note.top = top;
            note.width = width;
            note.height = height;
            
            note.rawnote=notedata;            
            
            note.zIndex = highestZ;
    }

    if (thisPageNotes.length > 0)
        applyCSS();
}

function modifiedString(date)
{
    return  date.getFullYear() + '-' + (date.getMonth() + 1) + '-' + date.getDate() + ' ' + date.getHours() + ':' + pad(date.getMinutes());
}

function newNote()
{
    var note = new Note();
        
    note.left = (window.pageXOffset + Math.round(Math.random() * (window.innerWidth - 150))) + 'px';
    note.top = (window.pageYOffset + Math.round(Math.random() * (window.innerHeight - 200))) + 'px';
    note.zIndex = ++highestZ;
    note.editField.focus();

    chrome.extension.sendRequest({action:"updatecount"});

    applyCSS();
}
function applyCSS(localstorage){
	var newline=unescape("%"+"0A");
	var deleteButton = chrome.extension.getURL("img/webnote_delete.png");
	if(document.getElementById('syncpadwebnotescss') == null){
		var headID = document.getElementsByTagName("head")[0];
		var cssNode = document.createElement('link');
		cssNode.setAttribute('id','syncpadwebnotescss');
		cssNode.media = 'screen';
		cssNode.type = 'text/css';
		cssNode.rel = 'stylesheet';
		headID.appendChild(cssNode);
	}
	css = '.syncpad-webnote .closebutton{background-image: url('+deleteButton+');}' + newline;

	if(localstorage != undefined){
		if(localstorage['bg_color'] != undefined)
			css += '.syncpad-webnote {background-color: #'+localstorage['bg_color']+';}'+ newline;
		if(localstorage['t_color'] != undefined)
			css += '.syncpad-webnote {color: #'+localstorage['t_color']+';}'+ newline;
		if(localstorage['font'] != undefined)
			css += '.syncpad-webnote  .edit {font-family: '+localstorage['font']+';}' +newline;
		if(localstorage['font_size'] != undefined)
			css += '.syncpad-webnote  .edit {font-size: '+localstorage['font_size']+';}' +  newline;
		if(localstorage['bb_color'] != undefined)
			css += '.syncpad-webnote .timestamp {background-color: #'+ localstorage['bb_color'] +';}'+ newline;
		if(localstorage['bt_color'] != undefined)
			css += '.syncpad-webnote .timestamp {color: #'+ localstorage['bt_color'] +';}';
	}
	document.getElementById('syncpadwebnotescss').href = 'data:text/css,'+escape(css);

}

function loadCSS(json){
	localstorage = eval(json);
	applyCSS(localstorage);
}

//applyCSS();

chrome.extension.onRequest.addListener(function(request,sender,response) {    
    if (request.action == "new") {
        newNote();
        response();
    } else if (request.action="loadnotes") {
        loadNotes(request.notes);
        response();
    }
});

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

function pad(n){
    return n<10 ? '0'+n : n
}