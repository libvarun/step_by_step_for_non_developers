$(document).ready(function () {
  var token = '';
  $('.generatetoken').click(function(){
    var ClientId = $('.clientid').val()
    var ClientSecret = $('.clientsecret').val();
    var payload = {clientid:ClientId,clientsecret:ClientSecret};
    $('.loader').show();
    jQuery.ajax({
      url: '/api/forge/oauth/token',
      data:payload,
      success: function (res) {
        var response = JSON.parse(res);
        token = response.access_token;
        $('.tokenresponse').text(JSON.stringify(response, null, 2))
        $('.step1response,.step2container').show('slow');
        getBuckets()
        // console.log(res)
      }
    });
  });
  
    $('.createbucket').click(function(){
      console.log('createbucket ')
      var bucketKey = $('.bucketname').val();
      var policyKey = 'transient';
      jQuery.post({
        url: '/api/forge/oss/buckets',
        contentType: 'application/json',
        data: JSON.stringify({ 'bucketKey': bucketKey, 'policyKey': policyKey, 'token':token }),
        success: function (res) {
          console.log(res.data.body);
          var response = JSON.stringify(res.data.body);
          $('.bucketresponse').text(response, null, 2);
          $('.step2response').show('slow');
          getBuckets();
        },
        error: function (err) {
          if (err.status == 409)
          alert('Bucket already exists - 409: Duplicated')
          console.log(err);
        }
      });
    });
    //}
    var Buckets;
    function getBuckets(){
      var payload = {token:token};
      $('.loader').show();
      jQuery.ajax({
        url: '/api/forge/oss/buckets',
        data:payload,
        success: function (res) {
          var list = res;
         
          // console.log(response)
          $('.loader').hide();
          if(list.length>0){
             Buckets = list;
             createBucketList();
          }
        }
      });
    }
    function createBucketList(){
      var template = '';
      for(var i = 0;i<Buckets.length;i++){
        template+='<option>'+Buckets[i].id+'</option>'
      }
      $('.buckets,.filesbucketname').html(template);
      $('.step3container').show('slow')
      $('.loader').hide();
    }
    
    $('#fileupload').change(function () {
      console.log(this.files)
      var bucket = $('.buckets').val()
      console.log(bucket)
      // return;
      if (this.files.length == 0) return;
      var file = this.files[0];
      var formData = new FormData();
          formData.append('fileToUpload', file);
          formData.append('bucketKey', bucket);
          formData.append('token', token);
          $('.loader').show();
          $.ajax({
            url: '/api/forge/oss/objects',
            data: formData,
            processData: false,
            contentType: false,
            type: 'POST',
            success: function (data) {
              console.log(data)
              var response = JSON.stringify(data.data.body, null, 2);
              $('.uploadresponse').text(response);
              $('.step3response').show('slow');
              $('.loader').hide();
              $('.step4container').show('slow')
              // $('#appBuckets').jstree(true).refresh_node(node);
            }
          });
          
        });
        var Files;
        var bucketKey; 
        
        $('.getfiles').click(function(){
          var bucket = $('.filesbucketname').val()
          bucketKey = bucket;
          var payload = {token:token,id:bucket};
          $('.loader').show();
          jQuery.ajax({
            url: '/api/forge/oss/buckets',
            data:payload,
            success: function (res) {
              Files = res;
              console.log(Files)
              if(Files.length>0){
                var response = JSON.stringify(Files, null, 2);
                $('.filesresponse').text(response);
                $('.step4response').show('slow');
                createFilesList();
              }
              
            }
          });
        })
          function createFilesList(){
            var template = '';
            for(var i = 0;i<Files.length;i++){
              template+='<li data-index='+i+'>'+Files[i].text+'</li>'
            }
            $('.fileslist').html(template);
            $('.step5container').show('slow')
            $('.loader').hide();
          }
          var objectKey;
        $( ".fileslist" ).on( "click", "li", function(){
          console.log('fileslist');
          var index = $(this).attr('data-index')
          var urn = Files[index].id;
          objectKey = urn;
          $('.loader').show();
          jQuery.ajax({
            url: 'https://developer.api.autodesk.com/modelderivative/v2/designdata/' + urn + '/manifest',
            headers: { 'Authorization': 'Bearer ' + token },
            success: function (res) {
              // $('.loader').hide();
              if (res.status === 'success') launchViewer(urn);
              else $("#forgeViewer").html('The translation job still running: ' + res.progress + '. Please try again in a moment.');
            },
            error: function (err) {
              $('.loader').hide();
              $('.translate_container').show('slow');
            }
          });
        })

        $( ".translate" ).click(function(){
          console.log('translateObject')
          $("#forgeViewer").empty();
          $('.loader').show();
          var data = JSON.stringify({ 'bucketKey': bucketKey, 'objectName': objectKey,'token':token })
          jQuery.post({
            url: '/api/forge/modelderivative/jobs',
            contentType: 'application/json',
            data: data,
            success: function (res) {
              console.log(res)
              var response = JSON.stringify(res.data.body, null, 2);
              $('.translateresponse').text(response);
              $('.step5response').show('slow');
              $('.translate_container').hide('slow');
              $("#forgeViewer").html('Translation started! Click on the file to view.');
              $('.loader').hide();
            },
          });
        });
});

var viewerApp;

function launchViewer(urn) {
  var options = {
    env: 'AutodeskProduction',
    getAccessToken: getForgeToken
  };
  var documentId = 'urn:' + urn;
  Autodesk.Viewing.Initializer(options, function onInitialized() {
    viewerApp = new Autodesk.Viewing.ViewingApplication('forgeViewer');
    viewerApp.registerViewer(viewerApp.k3D, Autodesk.Viewing.Private.GuiViewer3D);
    viewerApp.loadDocument(documentId, onDocumentLoadSuccess, onDocumentLoadFailure);
  });
}

function onDocumentLoadSuccess(doc) {
  // We could still make use of Document.getSubItemsWithProperties()
  // However, when using a ViewingApplication, we have access to the **bubble** attribute,
  // which references the root node of a graph that wraps each object from the Manifest JSON.
  var viewables = viewerApp.bubble.search({ 'type': 'geometry' });
  if (viewables.length === 0) {
    console.error('Document contains no viewables.');
    return;
  }

  // Choose any of the avialble viewables
  viewerApp.selectItem(viewables[0].data, onItemLoadSuccess, onItemLoadFail);
}

function onDocumentLoadFailure(viewerErrorCode) {
  console.error('onDocumentLoadFailure() - errorCode:' + viewerErrorCode);
}

function onItemLoadSuccess(viewer, item) {
  // item loaded, any custom action?
}

function onItemLoadFail(errorCode) {
  console.error('onItemLoadFail() - errorCode:' + errorCode);
}

function getForgeToken(callback) {  
  var ClientId = $('.clientid').val()
  var ClientSecret = $('.clientsecret').val();
  var payload = {clientid:ClientId,clientsecret:ClientSecret};
  $('.loader').show();
  jQuery.ajax({
    url: '/api/forge/oauth/token',
    data:payload,
    success: function (res) {
      var data = JSON.parse(res);
      $('.loader').hide();
      callback(data.access_token, data.expires_in);
    }
  });
} 

