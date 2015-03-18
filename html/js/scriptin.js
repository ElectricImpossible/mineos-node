var app = angular.module("mineos", []);
var connect_string = ':3000/';

/* filters */

app.filter('bytes_to_mb', function() {
    return function(bytes) {
      if (bytes == 0)
        return '0B';
      else if (bytes < 1024)
        return bytes + 'B';

      var k = 1024;
      var sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
      var i = Math.floor(Math.log(bytes) / Math.log(k));

      return (bytes / Math.pow(k, i)).toPrecision(3) + sizes[i];
    };
  })

app.filter('seconds_to_time', function() {
    return function(seconds) {
      function zero_pad(number){
        if (number.toString().length == 1)
          return '0' + number;
        else
          return number;
      }
      var hours = Math.floor(seconds / (60 * 60));

      var divisor_for_minutes = seconds % (60 * 60);
      var minutes = Math.floor(divisor_for_minutes / 60);

      var divisor_for_seconds = divisor_for_minutes % 60;
      var seconds = Math.ceil(divisor_for_seconds);
      
      return '{0}:{1}:{2}'.format(hours, zero_pad(minutes), zero_pad(seconds));
    }
  })

/* controllers */

app.controller("Webui", ['$scope', 'socket', function($scope, socket) {
  $scope.page = 'dashboard';
  $scope.servers = {};
  $scope.current = null;

  /* computed variables */

  $scope.servers_up = function() {
    return $.map($scope.servers, function(instance, server_name) {
      if ('heartbeat' in instance)
        return instance.heartbeat.up;
    }).length
  }

  $scope.players_online = function() {
    var online = 0;
    $.each($scope.servers, function(server_name, instance) {
      if ('heartbeat' in instance)
        online += instance.heartbeat.ping.players_online;
    })
    return online;
  }

  $scope.player_capacity = function() {
    var capacity = 0;
    $.each($scope.servers, function(server_name, instance) {
      if ('sp' in instance)
        capacity += instance.sp['max-players'];
    })
    return capacity;
  }

  /* socket handlers */

  socket.on('/', 'server_list', function(servers) {
    angular.forEach(servers, function(server_name) {
      this[server_name] = new server_model(server_name, socket);
    }, $scope.servers)
    console.log($scope.servers)
  })

  socket.on('/', 'host_heartbeat', function(data) {
    console.log(data)
    $scope.host_heartbeat = data;
  })

}]);

/* models */

function server_model(server_name, channel) {
  var self = this;

  self.server_name = server_name;
  self.channel = channel;

  self.channel.on(server_name, 'heartbeat', function(data) {
    self['heartbeat'] = data.payload;
  })

  self.channel.on(server_name, 'result', function(data) {
    if ('property' in data) {
      switch (data.property) {
        case 'server.properties':
          self['sp'] = data.payload;
          break;
        default:
          break;
      }
    }
  })

  self.channel.emit(server_name, 'property', {property: 'server.properties'});

  return self;
}

/* factories */

app.factory('socket', function ($rootScope) {
  //http://briantford.com/blog/angular-socket-io
  var sockets = {};
  return {
    on: function (server_name, eventName, callback) {
      if (!(server_name in sockets)) {
        if (server_name == '/')
          sockets[server_name] = io(connect_string);
        else
          sockets[server_name] = io(connect_string + server_name);
      }

      sockets[server_name].on(eventName, function () {  
        var args = arguments;
        $rootScope.$apply(function () {
          callback.apply(sockets[server_name], args);
        });
      });
    },
    emit: function (server_name, eventName, data, callback) {
      if (!(server_name in sockets)) {
        if (server_name == '/')
          sockets[server_name] = io(connect_string);
        else
          sockets[server_name] = io(connect_string + server_name);
      }

      sockets[server_name].emit(eventName, data, function () {
        var args = arguments;
        $rootScope.$apply(function () {
          if (callback) {
            callback.apply(sockets[server_name], args);
          }
        });
      })
    }
  };
})

/* prototypes */

String.prototype.format = String.prototype.f = function() {
  var s = this,
      i = arguments.length;

  while (i--) { s = s.replace(new RegExp('\\{' + i + '\\}', 'gm'), arguments[i]);}
  return s;
};