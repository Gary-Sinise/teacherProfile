// ----------  Teacher profile ----------
// --------------------------------------

// ---------- Global Variable Declaration (JSLint - Do Not Delete) ----------

/* exported
        textAreaAdjust, widgetPath, addKeyboardControlsToColorPicker, contrast
*/

/* global widgethost, tinycolor */

/*jshint sub:true*/

// ------------- Config Variables --------------
var widgetName = "teacher_profile";

// ------------- Global Variables --------------
var widget, roleDefs;

var widgetPath = widgethost + "/widgets/" + widgetName + "/";
var formData, profileEditorData;

var imgChanged = false;
var useDefaultImage = false;
var croppieSetupComplete = false;
var editorSetupComplete = false;
var uploadCrop = {};
var configData;
var configDataPath;

var langTerms;
var supportedLangs = ["en-us", "fr-ca","es-mx", "pt-br"];

var defaultConfigData;

function replaceDisplayedLangTerms() {

   // elemType can be text, button, or image
   function setText(elem, newText, elemType) {

      if (elemType === "button" || $(elem).attr("role") === "button") { 
         // set title and aria-label 
         $(elem).attr("aria-label", newText).attr("title", newText);         
         
      } else if (elemType === "img") { // replace alt text
         $(elem).attr("alt", newText);

      } else { // simply replace the text
         $(elem).text(newText);
      }
   }
   
   $("[data-lang-term]").each(function() {
      setText(this, langTerms[$(this).data("langTerm")], this.nodeName.toLowerCase());
      $(this).removeAttr("data-lang-term");
   });
}

// Resize widget to height of content
function resizeIframe() {
   var height = $("div.teacher_profile").outerHeight(true) + "px";
   parent.window.postMessage(JSON.stringify({
      subject: "frameResize",
      message: height
   }), '*');
}

function getLanguagePack() {
   
   var lang = "en-us";

   if (supportedLangs.indexOf(widget.instance.lang.toLowerCase()) > -1) {
      lang = widget.instance.lang.toLowerCase();
   }

   $.getJSON("lang/" + lang + ".txt", function (data) {
     
      langTerms = data;

   }).fail(function () {
    
      // default lang terms
      langTerms = {
         "bio": "This is stored in the cs_teacher_profile.js script file. I should be edited.",
         "bio-label": "About Me",
         "teacher-name": "CityU of Seattle",
         "role-header": "Instructor Profile",
         "linkedin": "LinkedIn",
         "twitter": "Twitter",
         "background-color": "Change background color",
         "save": "Save",
         "remove-image": "Remove profile image",
         "upload-image": "Upload profile image",
         "heading-text": "Heading Text",
         "display-name": "Display Name",
         "close": "Close",
         "edit": "Edit",
         "actions": "Actions for widget",
         "widgetTitle": "Profile Widget"
      };
      
   }).always(function () {

      recolorInit();
      parent.window.postMessage(JSON.stringify({ subject:"getRoleDefinitions", message: ""}),  '*');
    
      //set iframe title
      parent.window.postMessage(JSON.stringify({ subject: "setFrameTitle", message: {title:langTerms.widgetTitle}}), '*');
      
   });
}

function processRoleDefs(roleDefs) {

   // If user is an editor then set up the edit and save features
   if (roleDefs.editor.indexOf(widget.role.name) > -1) {
      $(".nav-section")
         .show()
         .css("display", "inline-block");

      $(".edit-button").on("click", function () {
         showEditorMode();
         resizeIframe();
         updateFormData();
         return false;
      });

      $(".save-button").on("click", function () {
         showLoadingOverlay();
         updateFormData(true);
      });

      $(".remove-image").on("click", function () {
         removeProfileImage();
      });
   }
}

function updateFormData(save) {
   // Save profile to the JSON form
   var formData = {};
   var bgColor = defaultConfigData["background-color"];
   $(".form-data").each(function () {
      var value = $(this).val();

      var schemaPath = $(this).attr("data-schemaid");
      formData[schemaPath] = value;

      if (value.trim() === "") {
         // No value
         //$(this).closest(".form-thing").hide();
         if (
            (schemaPath === "twitter" || schemaPath === "linkedin") && save
         ) {
            $(this)
               .closest(".form-thing")
               .next()
               .hide();
            $("." + schemaPath).hide();
         }
         if (schemaPath === "teacher-name") {
            $(".profile-image").addClass("reduce-top");
         }
         if (schemaPath === "bio") {
            value.replace(" ", /&nbsp;/g).replace("&#13;&#10;", /<br.*?>/g);
         }
      } else {
         // form element has a value
         if (schemaPath === "teacher-name") {
            $(".profile-image").removeClass("reduce-top");
         }
         if (schemaPath === "twitter" || schemaPath === "linkedin") {
            $(this)
               .closest(".form-thing")
               .next()
               .show();
            $("." + schemaPath).show();
         }

         if (schemaPath === "twitter") {
            $(".twitter-link").attr("href", value);
         }
         if (schemaPath === "linkedin") {
            $(".linkedin-link").attr("href", value);
         }
         if (schemaPath === "background-color") {
            changeBackgroundColor(tinycolor(value));
            bgColor = value;
         }
         if (schemaPath === "bio") {
           value = value.replace("\r\n", "N");
         }
      }
      
      let staticPageElem = $('div[data-schemaid="' + schemaPath + '"]');
      if (widget.replaceBioUrls && schemaPath === "bio") {
        value = replaceUrls(value);
        staticPageElem.html(value);
      } else {
        staticPageElem.text(value);
      }
   });

   var imageFilename = $(".profile-image").css("background-image");
   if (imageFilename === undefined) {
      imageFilename = $(".profile-image")
         .attr("style")
         .replace("background-image: ", "")
         .replace("\\", "");
   }
   imageFilename = imageFilename.replace(/^url\(['"]?/, "").replace(/['"]?\)$/, "");
   var qIndex = imageFilename.indexOf("?");
   if (qIndex !== -1) {
      imageFilename = imageFilename.substring(0, qIndex);
   }

   var bsIndex = imageFilename.indexOf('"');
   if (bsIndex !== -1) {
      imageFilename = imageFilename.substring(0, bsIndex);
   }

   formData.filename = imageFilename;
   formData["background-color"] = bgColor;

   if (save) {

      if (imgChanged && useDefaultImage) {
         formData.filename = defaultConfigData.filename;
      } else if (imgChanged) {
         formData.filename = "new file";
      }

      var oldData = profileEditorData;
      var newData = formData;

      if (compareJson(oldData, newData)) { // nothing changed
         hideEditorMode();
      } else {
         profileEditorData = newData; // something changed so update data
         checkColorInputs();
         checkImageInputs();
         processForm();
      }
   }
}

function showEditorMode() {

   if (!editorSetupComplete) {
      setUpEditor();
   }

   // Check char counts
   $("textarea, input").each(function () {
      processCharCount(this);
   });

   // enable inputs
   $("input").removeAttr("disabled");
   $("textarea").removeAttr("disabled");

   // update some styles
   $(".social-media-links")
      .find(".primary-sm")
      .removeClass("horizontal-flex");
   $(".linkedin")
      .show()
      .addClass("edit-mode");
   $(".twitter")
      .show()
      .addClass("edit-mode");
   $(".top-accent-bg").addClass("edit-mode");
   $(".top-accent-color").addClass("edit-mode");
   $(".profile-image").addClass("edit-mode");

   // hide things that are only visible to static view, show things only for editor mode
   $(".editor-only")
      .show()
      .attr("aria-hidden", "false");
   $(".static-only")
      .hide()
      .attr("aria-hidden", "true");

   // Show all the form fields which may have previously been hidden in static view because there was no entry.
   $(".form-thing").show();
}

function hideEditorMode() {
   // disable all inputs   
   $("textarea").attr("disabled", "");
   $("input").attr("disabled", "");

   // update social media link styles
   $(".social-media-links")
      .find(".primary-sm")
      .addClass("horizontal-flex");
   $(".linkedin").removeClass("edit-mode");
   $(".twitter").removeClass("edit-mode");
   $(".top-accent-bg").removeClass("edit-mode");
   $(".top-accent-color").removeClass("edit-mode");
   $(".profile-image").removeClass("edit-mode");

   // hide and show relevant items
   $(".editor-only")
      .hide()
      .attr("aria-hidden", "true");
   $(".static-only")
      .show()
      .attr("aria-hidden", "false");

   // reset some vars
   imgChanged = false;
   useDefaultImage = false;
   hideCroppie();
   hideLoadingOverlay();
}

function processCourseConfig(success, data) {

   defaultConfigData = {
      bio: langTerms["bio"],
      "bio-label": langTerms["bio-label"],
      linkedin: "https://www.linkedin.com/",
      filename: widgethost + "/widgets/teacher_profile/img/default.png",
      "role-header": langTerms["role-header"],
      "teacher-name": langTerms["teacher-name"],
      twitter: "https://twitter.com/",
      "background-color": "#275C36"
   };

   if (success) {
      configData = data;
   } else {
      configData = defaultConfigData;
   }

   buildForm();
   populateDisplayedFormData();
   replaceDisplayedLangTerms();
   hideLoadingOverlay();
}

function getConfigData() {
   parent.window.postMessage(JSON.stringify({
      subject: "getConfig",
      message: configDataPath,
      noCache: true
   }), '*');
}

function populateDisplayedFormData() {
   var parsedConfigData = configData;
   for (var key in parsedConfigData) {
      if (parsedConfigData.hasOwnProperty(key)) {
         var $formField = $('.form-data[data-schemaid="' + key + '"]');
         if (parsedConfigData[key].trim() === "") {
            //$formField.closest(".form-thing").hide();
            if (key === "twitter" || key === "linkedin") {
               $formField
                  .closest(".form-thing")
                  .next()
                  .hide();
               $("." + key).hide();
            }
            if (key === "teacher-name") {
               $(".profile-image").addClass("reduce-top");
            }
         } else {
            if (key === "teacher-name") {
               $(".profile-image").removeClass("reduce-top");
            }
            if (key === "twitter") {
               $(".twitter-link").attr("href", parsedConfigData[key]);
            }
            if (key === "linkedin") {
               $(".linkedin-link").attr("href", parsedConfigData[key]);
            }
            if (key === "background-color") {
               changeBackgroundColor(tinycolor(parsedConfigData[key]));
            }
         }
         $formField.val(parsedConfigData[key]);
        
        if (key === "bio" && widget.replaceBioUrls) {
          let bioText = replaceUrls(parsedConfigData[key]);
          $('div[data-schemaid="' + key + '"]').html(bioText); 
        } else {
          $('div[data-schemaid="' + key + '"]').text(parsedConfigData[key]); 
        }
          
          
          $("." + key + "-counter")
            .find(".current")
            .text(parsedConfigData[key].length);
      }
   }

}

function hideLoadingOverlay() {
   $(".loader-wrapper").fadeOut(function () {
      $(".container-fluid.hideme")
         .hide()
         .removeClass("hideme")
         .fadeIn();
      resizeIframe();
   });
}

function showLoadingOverlay() {
   $(".loader-wrapper").fadeIn();
}

// Used in the HTML file
function textAreaAdjust(textarea) {
   textarea.style.height = "1px";
   textarea.style.height = 10 + textarea.scrollHeight + "px";

   resizeIframe();
}

function processCharCount(elem) {

   //var extraChars = 0;
   // Counts newline strings differently on ios
   if (/iPhone|iPad/i.test(navigator.userAgent)) {
      //extraChars = $(elem).val().match(/(?:\r\n|\r|\n)/g);
      $(elem).val($(elem).val().replace(/(?:\r\n|\r|\n)/g, "\n"));
   }

   var characterCount = $(elem).val().length;
   var theCount = $($(elem).siblings(".counter")[0]);
   var current = theCount.find(".current");
   var maximum = theCount.find(".maximum");
   var maxlength = $(elem).attr("maxlength");

   current.text(characterCount);

   var opacity = characterCount / maxlength;
   if (opacity < 0.3) {
      opacity = 0.3;
   }
  // theCount.css("opacity", opacity);
   var disCounter = $(elem).parent().find('.counter');
   if (characterCount >= maxlength) {
     // maximum.css("color", "#FFBA59");
   //   current.css("color", "#FFBA59");

      $(disCounter).css("background-color", "#FFBA59");
      $(disCounter).css('border-radius', '14px');
      $(disCounter).addClass('badge');
      $(disCounter).addClass('badge-warning');
      
      var darkFontHex = "#000000";
      var lightFontHex = "#FFFFFF";
      var fontColor = tinycolor
      .mostReadable('#FFBA59', [darkFontHex, lightFontHex], {
         includeFallbackColors: true,
         level: "AA",
         size: "small"
      })
      .toHexString();
       $(disCounter).css('color', fontColor);
      //  maximum.css("color", fontColor);
      //  current.css("color", fontColor);

      theCount.css("font-weight", "bold");
   } else {
      // maximum.css("color", "#565A5C");
      var originalFontColor = $(disCounter).parent().find('label').css('color');

      theCount.css("font-weight", "normal");
      $(disCounter).css("color", originalFontColor);
      $(disCounter).css("background-color", "unset");
   }
}

function changeBackgroundColor(color) {

   $(".top-accent-color").css("background-color", color);
   $(".animate-colors").removeClass("animate-colors");
   $("#background-color-input").val(color);

   //https://stackoverflow.com/a/9733420/667602
   function luminanace(r, g, b) {
      var a = [r, g, b].map(function (v) {
         v /= 255;
         return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
      });
      return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
   }

   function contrast(rgb1, rgb2) {
      var result =
         (luminanace(rgb1[0], rgb1[1], rgb1[2]) + 0.05) /
         (luminanace(rgb2[0], rgb2[1], rgb2[2]) + 0.05);

      if (result < 1) {
         result = 1 / result;
      }

      return result;
   }

   var darkFontHex = "#565A5C";
   var lightFontHex = "#FFFFFF";
   var fontColor = tinycolor
      .mostReadable(color, [darkFontHex, lightFontHex], {
         includeFallbackColors: true,
         level: "AA",
         size: "small"
      })
      .toHexString();

   // if same as button color, add border to button to make it more visible.
   if (color.toHexString() === "#006fbf") {
      $(".save-button").addClass("orange-border");
   } else {
      $(".save-button").removeClass("orange-border");
   }

   $(".top-accent-bg label").css("color", fontColor);   
   $(".teacher-name").css("color", fontColor);  
   $(".role-header").css("color", fontColor);  
}

function buildForm() {
   var parsedConfigData = configData;
   // Set default pic if not available
   if (!parsedConfigData.hasOwnProperty("filename")) {
      parsedConfigData.filename = "";
   } else {
      setProfileImage(parsedConfigData.filename);
   }

   // set editor values with existing data where applicable
   profileEditorData = parsedConfigData;

}

// Returns true if same and false if not
function compareJson(json1, json2) {

   var same = true;

   if (Object.keys(json1).length === Object.keys(json2).length) {
      for (var property in json1) {
         if (json1[property] === json2[property]) {
            continue;
         } else {
            same = false;
            break;
         }
      }
   } else {
      same = false;
   }

   return same;
}

function hideCroppie() {

   $(".cr-slider-wrap").attr("aria-hidden", "true").hide();
   $(".cr-boundary").attr("aria-hidden", "true").hide();

}


function showCroppie(imgUrl) {
   $(".cr-slider-wrap").attr("aria-hidden", "false").show();
   $(".cr-boundary").attr("aria-hidden", "false").show(0, function () {
      uploadCrop.croppie('bind', {
         url: imgUrl
      });
   });

}

function setProfileImage(filename) {
   var timestamp = new Date().getTime();
   $(".profile-image").css(
      "background-image",
      "url('" + filename + "?v=" + timestamp + "')"
   );
}

function removeProfileImage() {
   setProfileImage(defaultConfigData.filename);
   $("#image-upload").val("");
   hideCroppie();
   imgChanged = true;
   useDefaultImage = true;
}

function setUpEditor() {

   $("textarea, input").keyup(function () {
      processCharCount(this);
   });

   $(document).on("change", "#image-upload", function () {
      readFile(this);
   });

   editorSetupComplete = true;

}

function setUpCroppie($elem, imgUrl) {

   uploadCrop = $elem.croppie({
      enableExif: true,
      viewport: {
         width: 150,
         height: 150,
         type: 'circle'
      }
   });


   // set the size of the cropie boundary and viewport
   $elem.find(".cr-boundary").css({
      height: "150px",
      width: "150px"
   });

   $elem.find(".cr-viewport").css({
      height: "150px",
      width: "150px"
   });

   $elem.find(".mobile-view .cr-boundary").css({
      height: "150px"
   });

   $elem.find(".mobile-view .cr-viewport").css({
      height: "150px",
      width: "150px"
   });

   $elem.find(".cr-slider").attr("step", "0.01");

   uploadCrop.croppie('bind', {
      url: imgUrl
   }).then(function () {
      croppieSetupComplete = true;
   });

}


function readFile(input) {
   if (input.files && input.files[0]) {
      var reader = new FileReader();
      reader.onload = function (e) {
         var imgUrl = e.target.result;
         imgChanged = true;
         useDefaultImage = false;

         $('.profile-image').css('background-image', 'none');

         if (!croppieSetupComplete) {
            setUpCroppie($("div.profile-image"), imgUrl);
         } else {
            showCroppie(imgUrl);
         }
      }
      reader.readAsDataURL(input.files[0]);

   } else {
      console.log("Sorry, your browser doesn't support the FileReader API.");
   }
}

function uploadConfigData(imageFilename) {

   formData = profileEditorData;

   if (imageFilename !== undefined) {
      formData.filename = imageFilename;
   }

   var data = {
      template: "uploadCourseContent",
      filedata: JSON.stringify(formData),
      filename: "config.txt",
      isImage: false
   }

   parent.window.postMessage(JSON.stringify({
      subject: "doValenceRequest",
      message: {
         route: "uploadFile",
         data: data
      }
   }), '*');

}

function uploadProfileImage() {
   var croppedImg = false;
   uploadCrop.croppie('result', {
      type: 'base64',
      circle: false
   }).then(function (resp) {
      croppedImg = resp;
      
      if (croppedImg) {
         var imgData = {
            template: "uploadCourseContent",
            filedata: croppedImg,
            filename: Date.now() + "_TP_IMG.png",
            isImage: true
         }

         parent.window.postMessage(JSON.stringify({
            subject: "doValenceRequest",
            message: {
               route: "uploadFile",
               data: imgData
            }
         }), '*');
      }
   });
}

function processForm() {
   if (imgChanged && !useDefaultImage) {
      uploadProfileImage()
   } else {
      uploadConfigData();
   }
}

function checkColorInputs() {
   $.each($('input[type="color"]'), function () {
      if ($(this).hasClass("spectrum-color") === false) {
         $(this).addClass("spectrum-color");
         $(this).spectrum({
            preferredFormat: "hex",
            showInput: true
         });
      }
   });
}

function checkImageInputs() {
   $.each($('[data-schemaid="file_upload"]'), function (idx) {
      if ($(this).hasClass("desc-added") === false) {
         this.id = idx;
         $(this).addClass("desc-added");
      }
   });
}

function removeBottomBorderRadius(element) {
   $(element).addClass("no-bottom-border-radius");
}

function resetBottomBorderRadius(element) {
   $(element).removeClass("no-bottom-border-radius");
}

function adjustColorPickerPosition(offset) {
   $(".sp-container").css(
      "top",
      parseInt($(".sp-container").css("top")) + offset + "px"
   );
}

function addKeyboardControlsToColorPicker(color) {
   //var thumbs = $(".sp-thumb-el");
   $(".sp-thumb-el").attr("tabindex", "0");
   $(".sp-thumb-el").on("focus", function () {
      $(".recolor-button").spectrum("set", $(this).attr("title"));
   });
}

function events(evt) {
   var payload = JSON.parse(evt.data);
   var subject = payload.subject;
   switch (subject) {
      case "doneGetReplaceStrings":
         //build widget
         widget = payload.message;
       
         /* 
         * Option to auto-replace URLs found in bios with html links instead
         * This could be set to false from the widget html page if
         * any client wants this feature disabled
         */
         if (typeof widget.replaceBioUrls !== "boolean") {
           widget.replaceBioUrls = true;
         }
         configDataPath = widget.instance.domain + widget.orgUnit.path + 'custom_widgets/teacher_profile/config.txt';

         getLanguagePack();

         break;

      case "doneGetRoleDefinitions":
         //build widget
         roleDefs = payload.message;
         processRoleDefs(roleDefs);
         getConfigData(); // does getConfig
         break;

      case "doneGetConfig":
         processCourseConfig(payload.message.success, payload.message.data);
         break;

      case "doneValenceRequest":
         switch (payload.message.route) {
            case "uploadFile":

               // if it's the image upload, then do the formdata upload next
               if (payload.message.dataArgument.isImage) {

                  var imagePath = widget.instance.domain + widget.orgUnit.path + 'custom_widgets/teacher_profile/img/' + payload.message.data.filename;
                  console.log(decodeString(imagePath))
                  setProfileImage(decodeString(imagePath));
                  uploadConfigData(decodeString(imagePath));

               } else {
                  hideEditorMode();
               }
               break;
         }
         break;

      default:
         //do something else
   }
}

function focusOnPicker() {
   $("a, area, button, input, object, select, textarea, [tabindex=\"0\"]").not(".recolor-button, .sp-thumb-el, .sp-palette-toggle, .sp-choose, #image-upload, .sp-input, [aria-hidden=\"true\"]").addClass("untabbable").attr("tabindex","-1");
}

function unfocusOnPicker() {
   $(".untabbable").attr("tabindex", "0").removeClass("untabbable");
   $("button.recolor-button")[0].focus();
}

// Searches text for urls and replaces them with a link html element
function replaceUrls(text) {
  
  /* 
   * Rule:
   * Start with "http://" or "https://" and end with newline or space
   *
   * Exception: 
   * Is if the last character is a '.', '!', '?', ')' or ','
   * That character would not be included. This is for cases where
   * URLs are in a sentence like "Visit my site at http://go.ca!"
   *
   * Regex tester: https://regexr.com/4vg79
   */
  let urlRegex = /(https?:\/\/)([^ \n])+([^ \n\.,?!)])/gi;
  function replacer (match) {    
    let link = "<a href=\"" + match + "\" target=\"_blank\">" + match + "</a>";    
    return link;
  }
  
  let newText = text.replace(urlRegex, replacer);
  return newText;
}

function decodeString(stringInput) {
   var newStringTemp = document.createElement('textarea');
   newStringTemp.innerHTML = stringInput;

   var newString = newStringTemp.value;
   return newString;
}


function recolorInit(){
  
  var currentColor = "#275C36";

  $(".recolor-button").spectrum({
     color: currentColor,
     showButtons: true,
     showPalette: true,
     showInput: true,
     showInitial: true,
     preferredFormat: "name",
     togglePaletteMoreText: "More",
     togglePaletteLessText: "Less",
     togglePaletteOnly: true,
     showSelectionPalette: false,
     paletteTabIndex: true,
     chooseText: langTerms.close,
     appendTo: ".picker-modal",
     show: function () {
        adjustColorPickerPosition(-6);
        removeBottomBorderRadius(this);
        focusOnPicker();
        //addKeyboardControlsToColorPicker();
     },
     hide: function () {
        resetBottomBorderRadius(this);
        unfocusOnPicker();
     },
     move: function (color) {
        changeBackgroundColor(color);
     },
     palette: [
     [
       "#BBF1FA",
       "#E8F2F9",
       "#E9E6FF",
       "#F6E1FA",
       "#FAE1ED",
       "#FAE1E2",
       "#FAE3CF",
       "#FAE5C8",
       "#FFFBB2",
       "#CDF2B1",
       "#A5FABD",
       "#A1F7F4"
     ],
     [
       "#00BDDD",
       "#29A6FF",
       "#AFA1FF",
       "#EA82FF",
       "#FF389B",
       "#FF6B70",
       "#E87511",
       "#FFBA59",
       "#F5EC5A",
       "#8CCD5A",
       "#46A661",
       "#00AFAA"
     ],
     [
       "#00849C",
       "#006FBF",
       "#7862F0",
       "#B24AC7",
       "#BF2A75",
       "#CD2026",
       "#A6540D",
       "#A87B3B",
       "#A69F21",
       "#59823A",
       "#327846",
       "#017D79"
     ],
     [
       "#005B6B",
       "#005694",
       "#4C3F99",
       "#7E358C",
       "#96215C",
       "#A1191D",
       "#804008",
       "#694B25",
       "#635F15",
       "#3D5926",
       "#275C36",
       "#005E5B"
     ]
   ]
  });
}

// Init on load
$(function () {

   var spinner =
      '<div class="d2l-loading-spinner"><div class="d2l-loading-spinner-wrapper"><svg viewBox="0 0 42 42" class="d2l-loading-spinner-bg-blur" focusable="false"><g fill="none" fill-rule="evenodd" transform="translate(5 5)"><circle stroke="none" fill="#000" cx="16" cy="16" r="14"></circle></g></svg><svg viewBox="0 0 42 42" class="d2l-loading-spinner-bg" focusable="false"><g fill="none" fill-rule="evenodd" transform="translate(5 5)"><circle stroke-width="0.5" cx="16" cy="16" r="16" class="d2l-loading-spinner-bg-stroke"></circle><circle stroke="none" fill="#FFF" cx="16" cy="16" r="16"></circle><circle stroke-width="2" cx="16" cy="16" r="11"></circle></g></svg><svg viewBox="0 0 42 42" class="d2l-loading-spinner-slice1" focusable="false"><g fill="none" fill-rule="evenodd"><path d="M24 42h8c0-17.673-14.327-32-32-32v8c1.105 0 2 .895 2 2s-.895 2-2 2v20h20c0-1.105.895-2 2-2s2 .895 2 2z" fill="#FFF"></path><path d="M0 22c1.105 0 2-.895 2-2s-.895-2-2-2c13.255 0 24 10.745 24 24 0-1.105-.895-2-2-2s-2 .895-2 2c0-11.046-8.954-20-20-20z" fill="#E6EAF0"></path></g></svg><svg viewBox="0 0 42 42" class="d2l-loading-spinner-slice2" focusable="false"><g fill="none" fill-rule="evenodd"><path d="M24 42h8c0-17.673-14.327-32-32-32v8c1.105 0 2 .895 2 2s-.895 2-2 2v20h20c0-1.105.895-2 2-2s2 .895 2 2z" fill="#FFF"></path><path d="M0 22c1.105 0 2-.895 2-2s-.895-2-2-2c13.255 0 24 10.745 24 24 0-1.105-.895-2-2-2s-2 .895-2 2c0-11.046-8.954-20-20-20z" fill="#E6EAF0"></path></g></svg><svg viewBox="0 0 42 42" class="d2l-loading-spinner-slice3" focusable="false"><g fill="none" fill-rule="evenodd"><path d="M24 42h8c0-17.673-14.327-32-32-32v8c1.105 0 2 .895 2 2s-.895 2-2 2v20h20c0-1.105.895-2 2-2s2 .895 2 2z" fill="#FFF"></path><path d="M0 22c1.105 0 2-.895 2-2s-.895-2-2-2c13.255 0 24 10.745 24 24 0-1.105-.895-2-2-2s-2 .895-2 2c0-11.046-8.954-20-20-20z" fill="#E6EAF0"></path></g></svg><svg viewBox="0 0 42 42" class="d2l-loading-spinner-slice4" focusable="false"><g fill="none" fill-rule="evenodd"><path d="M24 42h8c0-17.673-14.327-32-32-32v8c1.105 0 2 .895 2 2s-.895 2-2 2v20h20c0-1.105.895-2 2-2s2 .895 2 2z" fill="#FFF"></path><path d="M0 22c1.105 0 2-.895 2-2s-.895-2-2-2c13.255 0 24 10.745 24 24 0-1.105-.895-2-2-2s-2 .895-2 2c0-11.046-8.954-20-20-20z" fill="#E6EAF0"></path></g></svg><svg viewBox="0 0 42 42" class="d2l-loading-spinner-slice5" focusable="false"><g fill="none" fill-rule="evenodd"><path d="M24 42h8c0-17.673-14.327-32-32-32v8c1.105 0 2 .895 2 2s-.895 2-2 2v20h20c0-1.105.895-2 2-2s2 .895 2 2z" fill="#FFF"></path><path d="M0 22c1.105 0 2-.895 2-2s-.895-2-2-2c13.255 0 24 10.745 24 24 0-1.105-.895-2-2-2s-2 .895-2 2c0-11.046-8.954-20-20-20z" fill="#E6EAF0"></path></g></svg></div></div>';

   $(".loader-wrapper").append(spinner);

   $(".editor-only")
      .hide()
      .attr("aria-hidden", "true");

   //post message
   window.addEventListener('message', events, false);

   //get replace strings
   parent.window.postMessage(JSON.stringify({
      subject: "getReplaceStrings",
      message: ""
   }), '*');
   
   $(document).on("keypress", ".sp-thumb-el", function (event) {
      if (event.which === 13 || event.which === 32) {
         changeBackgroundColor(tinycolor($(this).attr("title")));
         $(".recolor-button").spectrum("set", $(this).attr("title"));
         $(this).focus();
      }
   });

   $(document).on("keypress", ".sp-input", function (event) {
      if (event.which === 13) {
         changeBackgroundColor(tinycolor($(this).val()));
         $(".recolor-button").spectrum("set", $(this).val());
      }
   });

   $(document).on("keyup", ".image-upload-label", function (e) {
      if (e.keyCode === 13) {
         $(this).click();
      }
   });
   
   var resizeId;
   $(window).on("resize", function () {
      clearTimeout(resizeId);
      resizeId = setTimeout(resizeIframe, 500);      
   });
   
});
