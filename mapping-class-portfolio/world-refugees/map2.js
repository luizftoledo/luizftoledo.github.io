mapboxgl.accessToken = "pk.eyJ1IjoibHVpemZ0b2xlZG8iLCJhIjoiY2wzdThtb3NkMGV4aDNjcGZlcXhucXFyeiJ9.9s7XbWK3kyKik-89KKmBUA";
var map = new mapboxgl.Map({
  container: "map",
  style:  "mapbox://styles/luizftoledo/cl4m00ddw002814obmv869s67",
  zoom: 0,
  maxZoom: 4,
  minZoom: 1,
  center: [11.725, -10.068],
  projection: 'equalEarth',

});

map.on("load", function () {
    map.addLayer(
        {
          id: "world_outline",
          type: "fill",
          source: {
            type: "geojson",
            data: "data/countries_refugee_map.geojson",
          },
          paint: {
        "fill-color": [
          "interpolate",
          ["get", "total_origin"],
          100,
          "#cf635d",
          1000,
          "#6193c7",
          2000,
          "#91b66e",
          "#ffffff",
        ],
        "fill-outline-color": "#999999",
        "fill-opacity": 0.5,
      },
    },
    "waterway-label"
  );

});
  
map.on("click", "world_outline", function (e) {
  var refugees_origin = e.features[0].properties.total_origin;
  var refugees_asylum = e.features[0].properties.total_asylum;
  new mapboxgl.Popup()
    .setLngLat(e.lngLat)
    .setHTML(
      "<h4>" +
        refugees_origin +
        "</h4>" +
        "<h2>" +
        refugees_asylum 
    )
    .addTo(map);
});
// Change the cursor to a pointer when the mouse is over the world outline layer.
map.on("mouseenter", "world_outline", function () {
  map.getCanvas().style.cursor = "pointer";
});
// Change it back to a pointer when it leaves.
map.on("mouseleave", "world_outline", function () {
  map.getCanvas().style.cursor = "";
});

map.on("click", "world_outline", function (e) {
  var refugees_origin = e.features[0].properties.total_origin;
  var refugees_asylum = e.features[0].properties.total_asylum;
  new mapboxgl.Popup()
    .setLngLat(e.lngLat)
    .setHTML(
      "<h4>" +
        refugees_origin +
        " - " +
        refugees_asylum +
        "</h4>" 
    )
    .addTo(map);
});
map.on("mouseenter", "world_outline", function () {
  map.getCanvas().style.cursor = "pointer";
});
map.on("mouseleave", "world_outline", function () {
  map.getCanvas().style.cursor = "";
});