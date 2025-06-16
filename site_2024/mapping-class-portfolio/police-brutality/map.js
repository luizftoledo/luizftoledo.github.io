mapboxgl.accessToken = "pk.eyJ1IjoibHVpemZ0b2xlZG8iLCJhIjoiY2wzdThtb3NkMGV4aDNjcGZlcXhucXFyeiJ9.9s7XbWK3kyKik-89KKmBUA";
var map = new mapboxgl.Map({
  container: "map",
  style: "mapbox://styles/luizftoledo/cl3ugxvw8004z14nyyg2hihuv",
  zoom: 0,
  maxZoom: 9,
  minZoom: 3.2,
  center: [-99, 38],
  maxBounds: [
    [-180, 15],
    [-30, 72],
  ],
  projection: "albers",
});

map.on("load", function () {
  let layers = map.getStyle().layers;
    for (var i=0; i<layers.length; i++) {
    console.log(layers[i].id)}

map.addLayer(
{
  id: "police_brutality_points",
  type: "circle",
  source: {
    type: "geojson",
    data: "https://raw.githubusercontent.com/browninstitute/pointsunknowndata/main/webmapAssignmentDataset/policeBrutality.geojson",
  },
  paint: {
    'circle-radius': 4,
    "circle-color": '#frfrfr',
    "circle-stroke-color": "#ffffff",
    "circle-stroke-width": 0.5,
    "circle-opacity": 0.5,
  },
  minzoom: 3,
},
"settlement-minor-label"
);

});

// Create the popup
map.on('click', 'police_brutality_points', function (e) {
var cityName = e.features[0].properties.city;
var stateName = e.features[0].properties.state;
var date = e.features[0].properties.date;
var description = e.features[0].properties.description;
new mapboxgl.Popup()
  .setLngLat(e.lngLat)
  .setHTML('<h2>' + cityName + ', ' + stateName + '</h2>' 
  + '<h4>' + date + '</h4>' 
  + '<p>' + description + '</p>'
      )
  .addTo(map);
});
map.on('mouseenter', 'police_brutality_points', function () {
map.getCanvas().style.cursor = 'pointer';
});
map.on('mouseleave', 'police_brutality_points', function () {
map.getCanvas().style.cursor = '';
});