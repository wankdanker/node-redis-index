module.exports = promised;

function promised () {
    var args = Array.prototype.slice.call(arguments);
    var context = args.shift();
    var method = args.shift();

    var p = new Promise(function (resolve, reject) {
        args.push(function cb() {
            var args2 = Array.prototype.slice.call(arguments);
            var err = args2.shift();

            if (err) {
                return reject(err);
            }

            return resolve.apply(p, args2);
        });

        return method.apply(context, args);
    });

    return p;
}