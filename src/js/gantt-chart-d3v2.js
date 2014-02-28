/**
 * @author Dimitry Kudrayvtsev
 * @version 2.1
 */

// Edited by David Hulme

d3.gantt = function() {
  var margin = {
    top: 10,
    right: 0,
    bottom: 20,
    left: 150
  };
  
  var timeDomainStart
    , timeDomainEnd;
    
  var taskTypes = [];
  var height = 350;
  var width = $('#ganttSvg').parents('.svg-container').width();

  var tickFormat = '%H:%M';

  var keyFunction = function(d) {
    return d.startDate + d.projectName + d.endDate;
  };

  var rectTransform = function(d) {
    return 'translate(' + x(d.startDate) + ',' + y(d.projectName) + ')';
  };

  var x = d3.time.scale()
    , y = d3.scale.ordinal()
    , xAxis = d3.svg.axis()
    , yAxis = d3.svg.axis();

  var initTimeDomain = function(tasks) {
    var startDates = tasks.map(function(d) {
      return d.startDate;
    });
    var endDates = tasks.map(function(d) {
      return d.endDate;
    });
    
    timeDomainStart = d3.min(startDates);
    timeDomainEnd = d3.max(endDates);
  };
  
  var getBarFill = function(d, index) {
    switch (index % 4) {
      case 0: return '33b5e5';
      case 1: return '669900';
      case 2: return 'ffbb33';
      case 3: return 'CC0000';
    }
  };

  var initAxis = function() {
    x = d3.time.scale()
      .domain([timeDomainStart, timeDomainEnd])
      .range([0, width - margin.left - margin.right])
      .clamp(true);
      
    y = d3.scale.ordinal()
      .domain(taskTypes)
      .rangeRoundBands([0, height - margin.top - margin.bottom], .1);
      
    xAxis = d3.svg.axis()
      .scale(x)
      .orient('bottom')
      .tickFormat(d3.time.format(tickFormat))
      .tickSubdivide(true)
      .tickSize(8)
      .tickPadding(8);

    yAxis = d3.svg.axis()
      .scale(y)
      .orient('left')
      .tickSize(0)
      .tickFormat(function(d) {
        if (d.length > 23) {
          return d;//d.substring(0, 21) + '\n...';
        } else {
          return d;
        }
      });
  };
  
  
    
  function gantt(tasks) {
	
    initTimeDomain(tasks);
    initAxis();

    var svg = d3.select('#ganttSvg')
      .attr('class', 'gantt')
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom)
      .append('g')
        .attr('class', 'gantt-chart')
        .attr('width', width + margin.left + margin.right)
        .attr('height', height + margin.top + margin.bottom)
        .attr('transform', 'translate(' + margin.left + ', ' + margin.top + ')');

    svg.selectAll('.gantt')
     .data(tasks, keyFunction).enter()
     .append('rect')
      .attr('rx', 5)
      .attr('ry', 5)
      .style('fill', getBarFill)
      .attr('y', 0)
      .attr('transform', rectTransform)
      .attr('height', function(d) {
        return y.rangeBand();
      })
      .attr('width', function(d) { 
        return (x(d.endDate) - x(d.startDate)); 
      });
	 
    svg.append('g')
      .attr('class', 'y axis')
      .transition()
      .call(yAxis);
      
    svg.selectAll('.y.axis text').each(function() {
      var self = $(this);
      if (self.width() > margin.left) {
        var name = self.text()
          , spaceIndex = name.substring(0, name.length/2).lastIndexOf(' ')
          , html = '<tspan>' + name.substring(0, spaceIndex) + '</tspan>'
            + '<tspan dy="15" x="0">'
            + name.substring(spaceIndex + 1) + '</tspan>';
        self.html(html);
      }
    });
      
    svg.append('g')
      .attr('class', 'x axis')
      .attr('transform', 'translate(0, ' + (height - margin.top - margin.bottom) + ')')
      .transition()
      .call(xAxis);

    return gantt;
  };
    
  gantt.redraw = function(tasks) {
    initTimeDomain(tasks);
    initAxis();
	
    var svg = d3.select('#ganttSvg');

    var ganttChartGroup = svg.select('.gantt-chart');
    var rect = ganttChartGroup.selectAll('rect').data(tasks, keyFunction);

    rect.enter()
      .insert('rect', ':first-child')
      .attr('rx', 5)
      .attr('ry', 5)
      .transition()
      .attr('y', 0)
      .attr('transform', rectTransform)
      .attr('height', function(d) { 
        return y.rangeBand(); 
      })
      .attr('width', function(d) { 
        return (x(d.endDate) - x(d.startDate)); 
      });

    rect.transition()
      .attr('transform', rectTransform)
      .attr('height', function(d) {
        return y.rangeBand(); 
      })
      .attr('width', function(d) { 
        return (x(d.endDate) - x(d.startDate)); 
      });
        
    rect.exit().remove();

    svg.select('.x').transition().call(xAxis);
    svg.select('.y').transition().call(yAxis);

    return gantt;
  };

  gantt.margin = function(value) {
    if (!arguments.length)
	    return margin;
    margin = value;
    return gantt;
  };

  gantt.timeDomain = function(value) {
    if (!arguments.length)
      return [ timeDomainStart, timeDomainEnd ];
    timeDomainStart = +value[0], timeDomainEnd = +value[1];
    return gantt;
  };


  gantt.taskTypes = function(value) {
    if (!arguments.length)
	    return taskTypes;
    taskTypes = value;
    return gantt;
  };
    
  gantt.taskStatus = function(value) {
    if (!arguments.length)
        return taskStatus;
    taskStatus = value;
    return gantt;
  };

  gantt.width = function(value) {
    if (!arguments.length)
        return width;
    width = +value;
    return gantt;
  };

  gantt.height = function(value) {
    if (!arguments.length)
        return height;
    height = +value;
    return gantt;
  };

  gantt.tickFormat = function(value) {
    if (!arguments.length)
        return tickFormat;
    tickFormat = value;
    return gantt;
  };

  return gantt;
};
