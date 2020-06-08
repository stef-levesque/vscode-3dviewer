/**
 * @author mrdoob / http://mrdoob.com/
 */

var Config = function ( name ) {

	function MemStorage() { }
	MemStorage.prototype = {
		setItem: function (name, value) {
			this[name] = value;
		},
		getItem: function (name) {
			return this[name];
		},
		removeItem: function (name) {
			if (this[name] && typeof this[name] !== 'function') {
				delete this[name];
			}
		},
		clear: function () {
			for (var name in this) {
				if (this.hasOwnProperty(name))
					delete this[name];
			}
		}
	};
	window.memStorage = new MemStorage();

	var storage = {
		'autosave': true,
		'theme': 'editor/css/light.css',

		'project/title': '',
		'project/editable': false,

		'project/renderer': 'WebGLRenderer',
		'project/renderer/antialias': true,
		'project/renderer/gammaInput': false,
		'project/renderer/gammaOutput': false,
		'project/renderer/shadows': true,

		'project/vr': false,

		'settings/history': false
	};

	if (window.memStorage[ name ] === undefined ) {

		window.memStorage[ name ] = JSON.stringify( storage );

	} else {

		var data = JSON.parse(window.memStorage[ name ] );

		for ( var key in data ) {

			storage[ key ] = data[ key ];

		}

	}

	return {

		getKey: function ( key ) {

			return storage[ key ];

		},

		setKey: function () { // key, value, key, value ...

			for ( var i = 0, l = arguments.length; i < l; i += 2 ) {

				storage[ arguments[ i ] ] = arguments[ i + 1 ];

			}

			window.memStorage[ name ] = JSON.stringify( storage );

			console.log('[' + /\d\d\:\d\d\:\d\d/.exec(new Date())[0] + ']', 'Saved config to MemStorage.' );

		},

		clear: function () {

			delete window.memStorage[ name ];

		}

	};

};
