/*
SiFu fragen: 
- wie kann ich Text-Labels dynamisch generieren UND ausrichten? (z.B.: Center)?
- wie kann ich im Center Fotos verlinken ab einer gewissen Stufe?
. wie gebe ich die Farben als Array an (leichteste Frage)

ToDo: 
- Linien rund um Segmente zeichnen
- Ordnen nach Parteifarben (da stecke ich gerade)
- Buttons für: Geschlecht, Partei, Bestellungsgremien

*/

(function(){ //don't accidentially pollute the global scope

  	var margin = {top: 350, right: 480, bottom: 350, left: 480},
  	//SiFu: bitte erklären. Wieso nur Margins und kein width/height? (aus Beispiel: http://bl.ocks.org/mbostock/5944371)
        //width = 960 - margin.left - margin.right,
        //height = 500 - margin.top - margin.bottom;
        radius = Math.min(margin.top, margin.right, margin.bottom, margin.left) -10;

	var color = d3.scale.category20c();
	//var color = ["#1b9e77","#d95f02", "#7570b3", "#e6ab02", "#ffff33" ]

		var svg = d3.select("body").append("svg")
		.attr("width", margin.left + margin.right)
		.attr("height", margin.top + margin.bottom )
	   .append("g")
	   	.attr("transform", "translate(" + margin.left + "," + margin.top + ")");

	var partition = d3.layout.partition()
		.sort(function(a, b) {
			if(a.depth === 1){
			return d3.ascending(a.name, b.name); 
		}else if(a.depth === 2){
			return d3.ascending(a.partei, b.partei); // wie nach Parteifarbe sortieren??
		}
		})
		.size([2 * Math.PI, radius])

	var arc = d3.svg.arc()
		.startAngle(function(d){ return d.x; })
		.endAngle(function(d){ return d.x + d.dx - 0.01 / (d.depth + 0.5); })//erklären...
		.innerRadius(function(d){ return radius / 3 * d.depth; })
		.outerRadius(function(d){ return radius / 3 * (d.depth + 1) -1; });
	
	d3.json("Stiftungsrat.json", function (error, root){
		//comments from mbostock:
			// Compute the initial layout on the entire tree to sum sizes.
  			// Also compute the full name and fill color for each node,
  			// and stash the children so they can be restored as we descend.
		partition 
			.value(function(d) { return d.value; })
			.nodes(root)
			.forEach(function(d){
				d._children = d.children;
				d.sum = d.value;
				d.key = key(d); // siehe unten!
				d.fill = fill(d); // siehe unten!
			});

			
			// Now redefine the value function to use the previously-computed sum.
		partition
			.children(function(d, depth) { return depth < 2 ? d._children : null; })
			.value(function(d) { return d.sum; });

		var center = svg.append("g")
			.on("click", zoomOut); 

		center.append("circle")
			.attr("r", radius / 3);

		center.append("title")
			.text("zoom out");

		var path = svg.selectAll("path")
			.data(partition.nodes(root).slice(1)) // was macht slice GENAU?
		  .enter()
		  	.append("path")
		  	.attr("d", arc)
		  	.style("fill", function(d) { return d.fill; })
		  	.each(function(d) { this._current = updateArc(d); })//woher kommt _current auf einmal??
		  	.on("click", zoomIn);

		  path.append("title")
		  	.text("zoom in");

		  var label = center.append("text")
		  	.text("Stiftungsrat")
		  	.attr("x", - 45 );


		function zoomIn(p){
			if (p.depth > 1) p = p.parent;
			if (!p.children) return;
			zoom(p, p, p.name);
			label.text("");
		}

		function zoomOut(p){
			if (!p.parent) return; 
			label.text("");
			zoom(p.parent, p, p.parent.name);
		}

		function zoom(root, p, labelText ){
			if (document.documentElement.__transition__) return; //to check for CSS transitions

			var enterArc,
				exitArc,
				outsideAngle = d3.scale.linear().domain([0, 2 * Math.PI]);

			function insideArc(d) {
				return p.key > d.key
					? {depth: d.depth - 1, x: 0, dx: 0} : p.key < d.key
					? {depth: d.depth - 1, x: 2 * Math.PI, dx: 0}
					: {depth: 0, x: 0, dx: 2 * Math.PI};
			}

			function outsideArc(d) {
				return {depth: d.depth + 1, x: outsideAngle(d.x), dx: outsideAngle(d.x + d.dx) - outsideAngle(d.x)};
			}

			center.datum(root);

			// When zooming in, arcs enter from the outside and exit to the inside.
    		// Entering outside arcs start from the old layout.
    		if (root === p) enterArc = outsideArc, exitArc = insideArc, outsideAngle.range([p.x, p.x+p.dx]);

    		path = path.data(partition.nodes(root).slice(1), function(d) { return d.key; });

			// When zooming out, arcs enter from the inside and exit to the outside.
    		// Exiting outside arcs transition to the new layout.
    		if (root !== p) enterArc = insideArc, exitArc = outsideArc, outsideAngle.range([p.x, p.x + p.dx]);

    		d3.transition().duration(d3.event.altKey ? 7500:750).each(function(){
    			path.exit().transition()
    				.style("fill-opacity", function(d) { return d.depth === 1 + (root === p) ? 1 : 0; })
    				.attrTween("d", function(d) { return arcTween.call(this, exitArc(d)); })
    				.remove();

    			path.enter().append("path")
    				.style("fill-opacity", function(d) { return d.depth === 2 - (root ===p) ? 1 : 0; })
    				.style("fill", function(d) { return d.fill; })
    				.on("click", zoomIn)
    				.each(function(d) {this._current = enterArc(d); });

    			path.transition()
    				.each("end", function(){ label.text( labelText )} )// hier braucht's noch eine if-Abfrage f. Zoom-Out
    				.style("fill-opacity", 1)
    				.attrTween("d", function(d) { return arcTween.call(this, updateArc(d)); })
    		});
		}
	});
	
	function key(d){
		var k = [];
		var p = d;
		while(p.depth) k.push(p.name), p=p.parent;
		return k.reverse().join(".");
	}

	function fill(d){

		var p= d;
		var c;

		if(p.depth === 1){ //p= p.parent;
			//var c = d3.lab(color(p.name));
			var c = "#999"
			return c;
		} else if(p.depth === 2) {
			var colors = {
				'SPÖ': 'red',
				'ÖVP': 'black',
				'FPÖ': 'blue',
				'Grüne': 'green',
				'BZÖ': 'orange',
				'unabhängig': '#444',
				'Kone': '#777'
			}
			return colors[p.partei];
		}
	}

	function arcTween(b) {
		var i = d3.interpolate(this._current, b);
		this._current = i(0);
		return function(t) {
			return arc(i(t));
		};
	}

	function updateArc(d){
		return {depth: d.depth, x: d.x, dx: d.dx};
	}

//d3.select(self.frameElement).style("height", margin.top + margin.bottom + "px");

})();
