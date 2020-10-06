var zlib = require('zlib');

module.exports.brotli = {
	encode : function (val) {
		return zlib.brotliCompressSync(val);
	}
	, decode : function (val) {
		return zlib.brotliDecompressSync(val)
	}
};

module.exports.deflate = {
	encode : function (val) {
		return zlib.deflateSync(val);
	}
	, decode : function (val) {
		return zlib.inflateSync(val)
	}
};

module.exports.gzip = {
	encode : function (val) {
		return zlib.gzipSync(val);
	}
	, decode : function (val) {
		return zlib.gunzipSync(val)
	}
};

try {
    var lz4 = require('lz4');

    module.exports.lz4 = {
        encode : function (val) {
            return lz4.encode(val);
        }
        , decode : function (val) {
            return lz4.decode(val);
        }
    }
}
catch (e) {}