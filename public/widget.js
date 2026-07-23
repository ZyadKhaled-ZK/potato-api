(function() {
  'use strict';

  var scripts = document.getElementsByTagName('script');
  var currentScript = scripts[scripts.length - 1];
  var widgetId = currentScript.getAttribute('data-widget-id');
  var apiBase = currentScript.getAttribute('data-api-base') || currentScript.src.replace(/\/widget\.js.*$/, '');

  if (!widgetId) {
    console.error('[Widget] data-widget-id is required');
    return;
  }

  function fetchConfig(callback) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', apiBase + '/api/widgets/' + widgetId + '/config', true);
    xhr.onload = function() {
      if (xhr.status === 200) {
        callback(null, JSON.parse(xhr.responseText));
      } else {
        callback(new Error('Failed to load widget config'));
      }
    };
    xhr.onerror = function() {
      callback(new Error('Network error loading widget config'));
    };
    xhr.send();
  }

  function createWidget(config) {
    var container = document.createElement('div');
    container.id = 'pw-widget-' + config.id;
    container.setAttribute('data-pw-widget', config.id);

    var theme = config.theme || {};
    var bgColor = theme.background || '#ffffff';
    var textColor = theme.text || '#333333';
    var accentColor = theme.accent || '#4f46e5';
    var borderRadius = theme.borderRadius || '8px';
    var position = theme.position || 'bottom-right';
    var offset = theme.offset || '20px';

    var posStyles = {};
    if (position === 'bottom-right') {
      posStyles = { bottom: offset, right: offset };
    } else if (position === 'bottom-left') {
      posStyles = { bottom: offset, left: offset };
    } else if (position === 'top-right') {
      posStyles = { top: offset, right: offset };
    } else if (position === 'top-left') {
      posStyles = { top: offset, left: offset };
    }

    container.style.cssText = 'position:fixed;z-index:999999;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;';
    for (var k in posStyles) container.style[k] = posStyles[k];

    var trigger = document.createElement('button');
    trigger.innerHTML = config.type === 'cta' ? (config.button_text || 'Learn More') : '&#9993;';
    trigger.style.cssText = 'padding:12px 24px;font-size:15px;font-weight:600;color:#fff;background:' + accentColor + ';border:none;border-radius:' + borderRadius + ';cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,0.15);transition:transform 0.2s;';
    trigger.onmouseenter = function() { trigger.style.transform = 'scale(1.05)'; };
    trigger.onmouseleave = function() { trigger.style.transform = 'scale(1)'; };

    var popover = document.createElement('div');
    popover.style.cssText = 'display:none;background:' + bgColor + ';color:' + textColor + ';border-radius:' + borderRadius + ';box-shadow:0 8px 30px rgba(0,0,0,0.2);padding:24px;width:320px;max-width:90vw;margin-bottom:12px;';

    var title = document.createElement('h3');
    title.textContent = config.title || 'Contact Us';
    title.style.cssText = 'margin:0 0 8px 0;font-size:18px;';
    popover.appendChild(title);

    if (config.description) {
      var desc = document.createElement('p');
      desc.textContent = config.description;
      desc.style.cssText = 'margin:0 0 16px 0;font-size:14px;opacity:0.8;';
      popover.appendChild(desc);
    }

    var form = document.createElement('form');
    form.style.cssText = 'display:flex;flex-direction:column;gap:12px;';

    var fields = config.fields || [];
    var honeypotField = null;

    fields.forEach(function(field) {
      if (field.type === 'hidden' && field.honeypot) {
        honeypotField = field.name;
        var hiddenInput = document.createElement('input');
        hiddenInput.type = 'text';
        hiddenInput.name = field.name;
        hiddenInput.style.cssText = 'position:absolute;left:-9999px;opacity:0;height:0;width:0;';
        hiddenInput.tabIndex = -1;
        hiddenInput.autocomplete = 'off';
        form.appendChild(hiddenInput);
        return;
      }

      var label = document.createElement('label');
      label.style.cssText = 'font-size:13px;font-weight:500;';

      var input;
      if (field.type === 'textarea') {
        input = document.createElement('textarea');
        input.rows = 3;
      } else if (field.type === 'select') {
        input = document.createElement('select');
        (field.options || []).forEach(function(opt) {
          var option = document.createElement('option');
          option.value = opt.value || opt;
          option.textContent = opt.label || opt;
          input.appendChild(option);
        });
      } else {
        input = document.createElement('input');
        input.type = field.type || 'text';
      }

      input.name = field.name;
      input.placeholder = field.placeholder || '';
      input.required = !!field.required;
      input.style.cssText = 'padding:10px 12px;border:1px solid #d1d5db;border-radius:6px;font-size:14px;outline:none;transition:border-color 0.2s;';
      input.onfocus = function() { input.style.borderColor = accentColor; };
      input.onblur = function() { input.style.borderColor = '#d1d5db'; };

      label.appendChild(document.createTextNode(field.label || field.name));
      label.appendChild(document.createElement('br'));
      label.appendChild(input);
      form.appendChild(label);
    });

    var submitBtn = document.createElement('button');
    submitBtn.type = 'submit';
    submitBtn.textContent = config.button_text || 'Submit';
    submitBtn.style.cssText = 'padding:10px;background:' + accentColor + ';color:#fff;border:none;border-radius:6px;font-size:14px;font-weight:600;cursor:pointer;transition:opacity 0.2s;';
    submitBtn.onmouseenter = function() { submitBtn.style.opacity = '0.9'; };
    submitBtn.onmouseleave = function() { submitBtn.style.opacity = '1'; };
    form.appendChild(submitBtn);

    var statusMsg = document.createElement('div');
    statusMsg.style.cssText = 'font-size:13px;display:none;padding:8px;border-radius:4px;margin-top:8px;';
    form.appendChild(statusMsg);

    form.onsubmit = function(e) {
      e.preventDefault();
      submitBtn.disabled = true;
      submitBtn.textContent = 'Sending...';

      var formData = {};
      var inputs = form.querySelectorAll('input, textarea, select');
      inputs.forEach(function(inp) {
        if (inp.name && inp.type !== 'submit') formData[inp.name] = inp.value;
      });

      var xhr = new XMLHttpRequest();
      xhr.open('POST', apiBase + '/api/submissions', true);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.onload = function() {
        submitBtn.disabled = false;
        submitBtn.textContent = config.button_text || 'Submit';
        if (xhr.status === 201) {
          statusMsg.textContent = 'Thank you! Your submission has been received.';
          statusMsg.style.cssText = 'font-size:13px;display:block;padding:8px;border-radius:4px;margin-top:8px;background:#d1fae5;color:#065f46;';
          form.reset();
          setTimeout(function() { popover.style.display = 'none'; }, 3000);
        } else {
          var resp = JSON.parse(xhr.responseText);
          statusMsg.textContent = resp.error || 'Something went wrong. Please try again.';
          statusMsg.style.cssText = 'font-size:13px;display:block;padding:8px;border-radius:4px;margin-top:8px;background:#fee2e2;color:#991b1b;';
        }
      };
      xhr.onerror = function() {
        submitBtn.disabled = false;
        submitBtn.textContent = config.button_text || 'Submit';
        statusMsg.textContent = 'Network error. Please try again.';
        statusMsg.style.cssText = 'font-size:13px;display:block;padding:8px;border-radius:4px;margin-top:8px;background:#fee2e2;color:#991b1b;';
      };
      xhr.send(JSON.stringify({ widget_id: config.id, data: formData, _hp: '' }));
    };

    popover.appendChild(form);

    var closeBtn = document.createElement('button');
    closeBtn.innerHTML = '&times;';
    closeBtn.style.cssText = 'position:absolute;top:8px;right:12px;background:none;border:none;font-size:20px;cursor:pointer;color:' + textColor + ';opacity:0.5;';
    closeBtn.onmouseenter = function() { closeBtn.style.opacity = '1'; };
    closeBtn.onmouseleave = function() { closeBtn.style.opacity = '0.5'; };
    closeBtn.onclick = function() { popover.style.display = 'none'; };
    popover.style.position = 'relative';
    popover.appendChild(closeBtn);

    trigger.onclick = function() {
      popover.style.display = popover.style.display === 'none' ? 'block' : 'none';
    };

    container.appendChild(popover);
    container.appendChild(trigger);
    document.body.appendChild(container);
  }

  fetchConfig(function(err, config) {
    if (err) {
      console.error('[Widget]', err.message);
      return;
    }
    createWidget(config);
  });
})();
