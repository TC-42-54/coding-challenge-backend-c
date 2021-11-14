var http = require('http');
var port = process.env.PORT || 2345;
const path = require('path')
const Search = require('./lib/Search')
const dataFilePath = path.join(__dirname, 'data', 'cities_canada-usa.tsv')
//getting the data from the .tsv file and sorting elements by 'name' attribute (alphabetical order)
const Cities = require('./lib/data')(dataFilePath).sort(({ name: prevName}, {name: nextName}) => prevName > nextName || (prevName < nextName ? -1 : 0))

const getQueryObject = url => {
  const queryObject = {}
  const queryIndex = url.indexOf('?')
  const queryString = queryIndex >= 0 ? url.substring(queryIndex + 1) : null
  const queryElements = !!queryString ? queryString.split('&') : []

  for (const queryElement of queryElements) {
    console.log(queryElement);
    const [queryAttribute = null, queryAttributeValue = null] = queryElement.split('=')

    if (queryAttribute === null || queryAttributeValue === null) continue

    queryObject[queryAttribute] = queryAttributeValue
  }

  return queryObject
}

const formatQuery = queryObject => {
  const validSearchAttributes = ['q', 'name']
  const distanceAttributes = ['latitude', 'longitude']
  const validQueryObject = {}
  for (validSearchAttribute of validSearchAttributes) {
    if (!(validSearchAttribute in queryObject)) continue
    const value = queryObject[validSearchAttribute]
    const attributeName = validSearchAttribute === 'q' ? 'name' : validSearchAttribute
    validQueryObject[attributeName] = value
  }

  for (const distanceAttribute of distanceAttributes) {
    if (!(distanceAttribute in queryObject)) break;
    if (!('distance' in validQueryObject)) validQueryObject.distance = {}
    const distanceAttributeValue = queryObject[distanceAttribute]
    const isNumber = !isNaN(distanceAttributeValue)
    const isFloat = isNumber && distanceAttributeValue % 1 !== 0
    validQueryObject.distance[distanceAttribute] = isNumber ? isFloat ? parseFloat(distanceAttributeValue) : parseInt(distanceAttributeValue) : distanceAttributeValue
  }

  return validQueryObject
}


// Creating the SearchEngine Instance and fill it with our data
// we also provide the criterias that the search can compute
// with their score, type, and config (if necessary)
const SearchEngine = new Search(Cities, {
    name: {
        type: 'text',
        weight: 0.6,
        config: {
            secondarySearchMalus: 0.1
        }
    },
    distance: {
        type: 'distance',
        config: {
            latitudeName: 'lat',
            longitudeName: 'long',
            limit: 1000
        },
        weight: 0.8
    }
},
["name", "id", "distance", "latitude", "longitude", "score"]) // list of acceptable attributes in the response objects

module.exports = http.createServer(function (req, res) {
  if (req.url.indexOf('/suggestions') === 0) {
    res.writeHead(200, {'Content-Type': 'application/json'});
    const query = getQueryObject(req.url)
    
    const validQuery = formatQuery(query)

    console.log(validQuery);

    const suggestions = Object.keys(validQuery).length ? SearchEngine.computeSearch(validQuery, 0.3, 15) : []

    res.end(JSON.stringify({
      suggestions
    }));
  } else {
    res.writeHead(404, {'Content-Type': 'text/plain'});
    res.end();
  }
}).listen(port, '127.0.0.1');

console.log('Server running at http://127.0.0.1:%d/suggestions', port);