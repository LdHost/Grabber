const Path = require('path');
const N3 = require('n3');
const RelativizeUrl = require('relativize-url').relativize;

class Grabber {
  constructor (targetDir, root, opts) {
    this.targetDir = targetDir;
    this.root = root;
    this.opts = opts;
    this.grabbed = [];
    this.started = new Set();
  }

  async grab (relativeTargetDir, url) {
    const resp = await fetch(url, {
      headers: {
        Accept: 'text/turtle'
      }
    });
    const contentType = resp.headers.get('content-type');
    const body = await resp.text();
    if (!resp.ok) {
      console.error(`Error reading ${url}:\n${body}`);
      return {type: '!ok', url, body};
    }

    if (contentType && !contentType.startsWith('text/turtle')) {
      console.warn(`Skipping ${url} with media type ${contentType}`);
      return {type: 'skipped', url, contentType};
    } else {
      let relativePath = RelativizeUrl(url, this.root.href) || './';
      if (relativePath.endsWith('/'))
        relativePath += 'index';
      if (Path.extname(relativePath) !== '.ttl')
        relativePath += '.ttl';
      this.grabbed.push({relativePath, url});
      if (this.opts.writer)
        await this.opts.writer(Path.join(this.targetDir, relativePath), body, url);

      const parser = new N3.Parser({baseURI: url});
      try {
        return await new Promise((resolve, reject) => {
          const childPs = [];
          parser.parse(body, (error, quad, prefixes) => {
            if (error) {
              reject(error);
            } else if (quad) {
              if (quad.object.termType === 'NamedNode') {
                const objUrl = new URL(quad.object.value);
                objUrl.hash = '';
                if (objUrl.protocol === this.root.protocol
                    && objUrl.host === this.root.host
                    && objUrl.port === this.root.port
                    && objUrl.pathname.startsWith(this.root.pathname)) {
                  if (!this.started.has(objUrl.href)) {
                    this.started.add(objUrl.href);
                    childPs.push(
                      this.grab(Path.join(this.targetDir, relativePath), objUrl)
                        .then(ret =>
                          Object.assign(ret, {predicate: quad.predicate.value})
                        )
                    );
                  }
                }
              }
            } else {
              Promise.all(childPs).then(children => {
                children.forEach(c => { if (c === null) console.log('HERE'); });
                resolve({relativePath, url: url.href, children});
              });
            }
          });
        });
      } catch (e) {
        console.error(`Skipping ${url} due to error:\n${e}`);
        return [];
      }
    }
  }

  report () {
    return `${this.grabbed.length} resources captured in ${this.root.href}:\n`
      + this.grabbed.map(({relativePath, url}) => `  ${relativePath} <- ${url}`).join('\n');
  }
}

module.exports = {Grabber};
