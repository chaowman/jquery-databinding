/*!
* jQuery DataBinding V1.0
* https://github.com/chaowman/jquery-databinding
*
* Copyright 2011, Chaowlert Chaisrichalermpol
* Licensed under the MIT licenses.
*
* Date: May 1, 2011
*/

(function ($) {
    //compare if data is same, hack for date comparison
    //- x = data 1
    //- y = data 2
    var _compareData = function (x, y) {
        if (x == y)
            return true;
        return $.type(x) === "date" &&
               $.type(y) === "date" &&
               x.getTime() === y.getTime();
    };

    //get value or set value with notification
    //- me = object
    //- path = property
    //- value = value to set (optional for get value)
    $.notifyProp = function (me, path, value) {
        var obj = me;
        var lastKey = path;
        var prop = path.split("[");
        var last = prop.length - 1;

        if (last > 0) {
            var getKey = function (str, i) {
                return (i === 0 ? str : parseInt(str.substr(0, str.length - 1)));
            }
            for (var j = 0; j < last; j++) {
                obj = obj[getKey(prop[j], j)];
            }
            lastKey = getKey(prop[last], last);
        }

        //get
        var currentValue = obj[lastKey];
        if (typeof value === "undefined")
            return currentValue;

        //set
        if (_compareData(currentValue, value))
            return me;
        obj[lastKey] = value;
        $(me).trigger("notifyPropertyChanged", [path, value]);
        return me;
    };

    //manipulate the collection with notification
    //- me = object
    //- path = property
    //- func = function to manipulate the collection
    //- arg1 = argument 1 (optional based on func)
    //- arg2 = argument 2 (optional based on func)
    $.notifyCol = function (me, path, func, arg1, arg2) {
        var list = $.notifyProp(me, path);
        switch (func) {
            case "push":    //append last
                var index = list.length;
                list.push(arg1);
                $(me).trigger("notifyCollectionChanged", [path, func, index, arg1]);
                break;
            case "pop":     //remove last
                list.pop();
                $(me).trigger("notifyCollectionChanged", [path, func, list.length]);
                break;
            case "insert":  //append specified position
                list.splice(arg1, 0, arg2);
                $(me).trigger("notifyCollectionChanged", [path, func, arg1, arg2]);
                break;
            case "remove":  //remove specified position
                list.splice(arg1, 1);
                $(me).trigger("notifyCollectionChanged", [path, func, arg1]);
                break;
            case "clear":   //remove all
                list.splice(0, list.length);
                $(me).trigger("notifyCollectionChanged", [path, func]);
                break;
            case "pushRange":   //append many items
                var index = list.length;
                list.splice.apply(list, [index, 0].concat(arg1));
                $(me).trigger("notifyCollectionChanged", [path, func, index, arg1]);
                break;
        }
        return me;
    };

    //compare to check if property is need to notify
    //- prop = updated property
    //- prop2 = binded property
    var _compareProp = function (prop, prop2) {
        if (prop == prop2)
            return true;
        var arry = prop.split("[");
        var arry2 = prop2.split("[");
        if (arry2.length < arry.length)
            return false;
        for (var i = 0; i < arry.length; i++) {
            if (arry[i] !== arry2[i])
                return false;
        }
        return true;
    };

    //track property change
    //- prop2 = property to track
    //- func = function invoke on notify
    //- id = namespace for event
    $.fn.trackChange = function (prop2, func, id) {
        return this.bind("notifyPropertyChanged" + (id ? "." + id : ""), function (e, prop, value) {
            if (_compareProp(prop, prop2))
                func.call(this, value);
        });
    };

    //traverse to parent until find the parent with dataContext, and return dataContext
    //- this = current element
    //- el = starting selector for lookup (optional), if begin with # find by id, if not traverse to parent
    var _getParentData = function (el) {
        var parent = this;
        if (typeof el === "string") {
            if (el.charAt(0) === "#")
                parent = $(el);
            else
                parent = this.parent(el);
        }
        while (parent.length > 0) {
            var data = parent.data("dataContext");
            if (data)
                return data;
            parent = parent.parent();
        }
        return null;
    };

    //execute casecard path ("prop1.prop2")
    //- this = element
    //- setting = setting to execute path, must have property "path"
    //- context = name of setting property to set context
    var _executePath = function (setting, context) {
        var prop = setting.path.split(".");
        var last = prop.length - 1;

        if (last > 0) {
            var self = this;
            var parents = [];
            var id = this[0][$.expando];
            for (var i = 0; i < last; i++) {
                var c = setting[context];
                setting[context] = $.notifyProp(c, prop[i])
                parents.push(c);
                $(c).trackChange(prop[i], function (value) {
                    $(parents).unbind("." + id);
                    self.applyDataBinding(true);
                }, id);
            }
            setting.path = prop[last];
        }
    };

    //apply data binding to self and children
    //- this = element
    var _applyDataBinding = function () {
        var hasContext = false;
        if (this.is("[data-source]")) {
            this.dataSource();
            hascontext = true;
        }
        if (this.is("[name]:input,[data-bind]")) {
            this.dataBind();
            hasContext = true;
        }
        if (!hasContext) {
            var c = this.children();
            for (var i = 0; i < c.length; i++)
                _applyDataBinding.call($(c[i]));
        }
    };

    //destroy data binding to self and children
    //- this = element
    var _destroyDataBinding = function () {
        var hasContext = false;
        var d = this.data("dataBind");
        if (d) {
            d.destroy();
            hasContext = true;
        }
        d = this.data("dataSource");
        if (d) {
            d.destroy();
            hasContext = true;
        }
        if (!hasContext) {
            var c = this.children();
            for (var i = 0; i < c.length; i++)
                _destroyDataBinding.call($(c[i]));
        }
    }

    //apply dataSource and dataBind to self and children
    //- refresh = if true, destroy and re-apply
    $.fn.applyDataBinding = function (refresh) {
        if (refresh) {
            this.each(function () {
                _destroyDataBinding.call($(this));
            });
        }
        return this.each(function () {
            _applyDataBinding.call($(this));
        });
    };

    //compile function from string to function
    //- setting = setting to compile
    //- name = name of setting property to compile
    var _compileFn = function (setting, name) {
        if (typeof setting[name] === "string") {
            var obj = window;
            var prop = setting[name].split(".");
            for (var i = 0; i < prop.length; i++)
                obj = obj[prop[i]];
            setting[name] = obj;
        }
    };

    //setting builder for dataSource
    //- this = element
    //- setting = setting to build
    var _dataSourceBuilder = function (setting) {
        //get data from attr
        var inline = this.attr("data-source");
        if (inline)
            $.extend(setting, $.parseJSON(inline));

        //get itemsSource
        if (!setting.itemsSource || typeof setting.itemsSource === "string")
            setting.itemsSource = _getParentData.call(this, setting.itemsSource);
        if (!setting.itemsSource)   //not found, exit
            return;
        if (setting.path)
            _executePath.call(this, setting, "itemsSource");
        else
            setting.notifyUpdate = false;

        //change string to function
        _compileFn(setting, "createItemCallback");
        _compileFn(setting, "create");

        //builder
        var builder = $.dataBinding.dataSource.builder;
        for (var i = 0; !setting.createItemCallback && i < builder.length; i++)
            builder[i].call(this, setting);
    };

    //add many items
    //- this = element
    //- items = array of items to add
    //- createItemCallback = function to create child
    var _pushRangeCallback = function (items, createItemCallback) {
        if (items.length > 0) {
            var fragment = document.createDocumentFragment();
            for (var i = 0; i < items.length; i++) {
                var newChild = createItemCallback.call(this, i, items[i]);
                fragment.appendChild(newChild[0]);
            }
            this[0].appendChild(fragment);
        }
    };

    //apply dataSource
    //- options = options to apply dataSource
    //  - create: function execute after create successfully
    //  - itemsSource: source for data
    //  - path: path to source
    //  - notifyUpdate: update when source change
    //  - itemTemplate: template for create new child
    //  - itemTemplateArg: argument for itemTemplate
    //  - createItemCallback: call when create new child
    //  - itemText: for SELECT text part
    //  - itemValue: for SELECT value part
    //  - itemTextSelector: for SELECT text part selector
    //  - itemValueSelector: for SELECT value part selector
    $.widget("dataBinding.dataSource", {
        options: {
            notifyUpdate: true
        },

        _create: function () {
            var self = this;
            var el = this.element;
            var setting = this.options;
            var id = "id" + el[0][$.expando];

            if (setting.itemsSource)
                setting.itemsSource = setting.itemsSource();

            //build setting
            _dataSourceBuilder.call(el, this.options);

            //if no itemsSource, do nothing
            if (!setting.itemsSource || !setting.createItemCallback) {
                delete this.create;
                this.destroy();
                return;
            }

            //extend createItemCallback
            var createItemFn = setting.createItemCallback;
            var _array = [];
            setting.createItemCallback = function (i, item) {
                var newChild = $(createItemFn.call(this, i, item));
                var cleanNode = newChild.filter(function () {
                    return this.nodeType === 1;
                });

                //set dataContext
                if ($.type(item) === "object")
                    cleanNode.data("dataContext", item);
                else
                    cleanNode.data("dataContext", setting.itemsSource);

                //apply child dataSource, dataBind
                cleanNode.applyDataBinding();

                //keep child for tracking
                _array.splice(i, 0, cleanNode);

                return cleanNode;
            };
            var _resetFn = function (value) {
                el.empty();
                _array.splice(0, _array.length);
                _pushRangeCallback.call(el, value, setting.createItemCallback);
            };

            if (setting.notifyUpdate) {
                //on collection change, perform per func
                $(setting.itemsSource).bind("notifyCollectionChanged." + id, function (e, prop, func, i, value) {
                    if (!_compareProp(prop, setting.path))
                        return;
                    switch (func) {
                        case "push":
                            var newChild = $(setting.createItemCallback.call(el, i, value));
                            el.append(newChild);
                            break;
                        case "insert":
                            var newChild = $(setting.createItemCallback.call(el, i, value));
                            var another = null;
                            for (var j = i + 1; j < _array.length; j++) {
                                if (_array[j].length > 0) {
                                    another = _array[j][0];
                                    break;
                                }
                            }
                            if (another)
                                newChild.insertBefore(another);
                            else
                                el.append(newChild);
                            break;
                        case "pop":
                        case "remove":
                            _array[i].remove();
                            _array.splice(i, 1);
                            break;
                        case "clear":
                            el.empty();
                            _array.splice(0, _array.length);
                            break;
                        case "pushRange":
                            _pushRangeCallback.call(el, value, setting.createItemCallback);
                            break;
                    }
                });
                //on property change reset
                $(setting.itemsSource).trackChange(setting.path, _resetFn, id);
            }

            //clear any existing data, and insert new data
            var source = setting.itemsSource;
            if (setting.path)
                source = $.notifyProp(source, setting.path);
            _resetFn(source);
        },

        _setOption: $.noop,

        destroy: function () {
            var setting = this.options;
            var el = this.element;

            $(setting.itemsSource).unbind(".id" + el[0][$.expando]);
            $(el).children().each(function () {
                var $this = $(this);
                _destroyDataBinding.call($this);
                $this.removeData("dataContext");
            });
            $.Widget.prototype.destroy.call(this);
        }
    });

    //setting builder for dataBind
    //- this = element
    //- setting = setting to build
    var _dataBindBuilder = function (setting) {
        //get data from attr
        var inline = this.attr("data-bind");
        if (inline)
            $.extend(setting, $.parseJSON(inline));

        //get dataContext
        if (!setting.path) {
            if (this.is("[name]:input"))
                setting.path = this.attr("name");
            else
                return;
        }
        if ($.type(setting.dataContext) !== "object")
            setting.dataContext = _getParentData.call(this, setting.dataContext);
        if (!setting.dataContext)   //not found, exit
            return;
        _executePath.call(this, setting, "dataContext");

        //change string to function
        _compileFn(setting, "getValueCallback");
        _compileFn(setting, "setValueCallback");
        _compileFn(setting, "cssClassCallback");
        _compileFn(setting, "create");

        //call builder
        var builder = $.dataBinding.dataBind.builder;
        for (var i = 0; i < builder.length; i++)
            builder[i].call(this, setting);

        //for anything else
        //setting.setValueCallback will always exists
        if (!setting.setValueCallback) {
            setting.setValueCallback = function (value) {
                this.text(value);
            };
        }

        //compare data before set
        if (setting.getValueCallback) {
            var setValueFn = setting.setValueCallback;
            setting.setValueCallback = function (value) {
                var oldValue = setting.getValueCallback.call(this);
                if (!_compareData(oldValue, value))
                    setValueFn.call(this, value);
            };
        }

        //cssClass
        if (!setting.cssClassCallback && setting.cssClass) {
            setting.cssClassCallback = function (value) {
                var cls = {};
                cls[setting.cssClass] = value;
                return cls;
            };
        }

        //cssClassCallback
        if (setting.cssClassCallback) {
            var setValueFn2 = setting.setValueCallback;
            setting.setValueCallback = function (value) {
                setValueFn2.call(this, value);
                var cls = setting.cssClassCallback.call(this, value);
                for (var key in cls) {
                    if (!cls[key])
                        this.removeClass(key);
                    else if (!this.hasClass(key))
                        this.addClass(key);
                }
            };
        }

        //no get, no trigger
        if (!setting.getValueCallback)
            setting.triggerEvent = null;
    };

    //apply dataBind
    //- options = options to apply dataBind
    //  - create: function execute after create successfully
    //  - dataContext: source of data
    //  - path: property to bind
    //  - notifyUpdate: notify if property changed
    //  - triggerEvent: event to update to source
    //  - getValueCallback: function to get value
    //  - setValueCallback: function to set value
    //  - valueTemplate: template for set function
    //  - valueTemplateArg: argument for valueTemplate
    //  - dataType: for SELECT, INPUT, to specify data type
    //  - onCreate: invoke after create dataBind
    //  - cssClass: add class when value is true
    //  - cssClassCallback: function to determine class
    $.widget("dataBinding.dataBind", {
        options: {
            notifyUpdate: true
        },

        _create: function () {
            var self = this;
            var el = this.element;
            var setting = this.options;
            var id = "id" + el[0][$.expando];

            if (setting.dataContext)
                setting.dataContext = setting.dataContext();

            //build setting
            _dataBindBuilder.call(el, setting);

            //set dataContext
            var data = setting.dataContext;
            if (setting.dataContext && setting.path)
                data = $.notifyProp(setting.dataContext, setting.path);
            if (!setting.dataContext || typeof data === "undefined") {
                delete this.create;
                this.destroy();
                return;
            }

            if ($.type(data) === "object") {
                setting.itemsSource = el.data("dataContext");
                el.data("dataContext", data);
            }
            el.children().applyDataBinding();

            //if no path exit
            if (!setting.path)
                return;

            //update
            setting.setValueCallback.call(el, data);

            //notify update
            if (setting.notifyUpdate) {
                var fn;
                if ($.type(data) === "object") {
                    fn = function (value) {
                        el.children().applyDataBinding();
                    };
                } else {
                    fn = function (value) {
                        setting.setValueCallback.call(el, value);
                    };
                }
                $(setting.dataContext).trackChange(setting.path, fn, id);
            }

            //save to source
            if (setting.triggerEvent) {
                el.bind(setting.triggerEvent + "." + id, function (e) {
                    $.notifyProp(setting.dataContext, setting.path, setting.getValueCallback.call(el));
                });
            }
        },

        _setOption: $.noop,

        destroy: function () {
            var setting = this.options;
            var el = this.element;
            var id = el[0][$.expando];

            $(setting.dataContext).unbind("." + id);
            el.unbind("." + id);

            $(el).children().each(function () {
                var $this = $(this);
                _destroyDataBinding.call($this);
            });
            if (setting.itemsSource)
                el.data("dataContext", setting.itemsSource);
            else
                el.removeData("dataContext");

            $.Widget.prototype.destroy.call(this);
        }
    });

    //create path for builder
    $.dataBinding.dataSource.builder = [];
    $.dataBinding.dataBind.builder = [];

    //fix deep copy of widget
    var fixDataSource = $.fn.dataSource;
    $.fn.dataSource = function (options) {
        if (options && options.itemsSource) {
            var c = options.itemsSource;
            options.itemsSource = function () { return c; };
        }
        return fixDataSource.call(this, options);
    };
    var fixDataBind = $.fn.dataBind;
    $.fn.dataBind = function (options) {
        if (options && options.dataContext) {
            var c = options.dataContext;
            options.dataContext = function () { return c; };
        }
        return fixDataBind.call(this, options);
    };

    //===========================================================================================================
    // Extension
    //===========================================================================================================

    //binding for template
    $.dataBinding.dataSource.templateBuilder = function (setting) {
        if (setting.itemTemplate) {
            var tmpl;
            if (setting.itemTemplate.charAt(0) === "#")
                tmpl = $.template(null, $(setting.itemTemplate));
            else
                tmpl = $.template(null, setting.itemTemplate);
            setting.createItemCallback = function (i, item) {
                return $.tmpl(tmpl, { "index": i, "item": item, "arg": setting.itemTemplateArg });
            };
        }
    };

    //support for dropdownlist
    $.dataBinding.dataSource.dropdownBuilder = function (setting) {
        var tagName = this.attr("tagName");

        if (tagName === "SELECT" || tagName === "OPTGROUP") {
            if (!setting.itemValueSelector) {
                if (setting.itemValue) {
                    if (!setting.itemText)
                        setting.itemText = setting.itemValue;
                    setting.itemValueSelector = function (item) { return $.notifyProp(item, setting.itemValue); };
                    if (!setting.itemTextSelector)
                        setting.itemTextSelector = function (item) { return $.notifyProp(item, setting.itemText); };
                } else {
                    setting.itemValueSelector = function (item) { return item; };
                }
            }
            _compileFn(setting, "itemValueSelector");
            _compileFn(setting, "itemTextSelector");

            if (!setting.itemTextSelector)
                setting.itemTextSelector = setting.itemValueSelector;

            setting.createItemCallback = function (i, item) {
                var option = $("<option/>");
                option.attr("value", setting.itemValueSelector.call(this, item)).text(setting.itemTextSelector.call(this, item));
                return option;
            };
        }
    };

    //for list
    $.dataBinding.dataSource.listBuilder = function (setting) {
        var tagName = this.attr("tagName");

        if (tagName === "OL" || tagName === "UL") {
            if (!setting.itemValueSelector) {
                if (setting.itemValue)
                    setting.itemValueSelector = function (item) { return $.notifyProp(item, setting.itemValue); };
                else
                    setting.itemValueSelector = function (item) { return item; };
            }
            setting.createItemCallback = function (i, item) {
                var li = $("<li/>");
                li.text(setting.itemValueSelector.call(this, item));
                return li;
            };
        }
    };

    //default builder
    if ($.fn.tmpl)
        $.dataBinding.dataSource.builder.push($.dataBinding.dataSource.templateBuilder);
    $.dataBinding.dataSource.builder.push($.dataBinding.dataSource.dropdownBuilder);
    $.dataBinding.dataSource.builder.push($.dataBinding.dataSource.listBuilder);

    //create function for template
    $.dataBinding.dataBind.templateBuilder = function (setting) {

        if (setting.valueTemplate && !setting.setValueCallback) {
            var tmpl;
            if (setting.valueTemplate.charAt(0) === "#")
                tmpl = $.template(null, $(setting.valueTemplate));
            else
                tmpl = $.template(null, setting.valueTemplate);
            setting.setValueCallback = function (value) {
                this.html($.tmpl(tmpl, { "value": value, "arg": setting.valueTemplateArg }));
                this.children().applyDataBinding();
            };
        }
    };

    //binding for date picker
    $.dataBinding.dataBind.datePickerBuilder = function (setting) {
        if (this.is("input.hasDatepicker")) {
            if (!setting.triggerEvent)
                setting.triggerEvent = "change";
            if (!setting.getValueCallback) {
                setting.getValueCallback = function () {
                    return this.datepicker("getDate");
                };
            }
            if (!setting.setValueCallback) {
                setting.setValueCallback = function (value) {
                    this.datepicker("setDate", value);
                };
            }
        }
    };

    //for SELECT, TEXT, TEXTAREA
    $.dataBinding.dataBind.inputBuilder = function (setting) {
        if (this.is("select,input:text,textarea")) {
            if (!setting.dataType) {
                var data = $.notifyProp(setting.dataContext, setting.path)
                setting.dataType = typeof data;
            }
            if (!setting.triggerEvent)
                setting.triggerEvent = "change";
            if (!setting.getValueCallback) {
                if (setting.dataType === "number") {
                    setting.getValueCallback = function () {
                        return parseInt(this.val());
                    };
                } else {
                    setting.getValueCallback = function () {
                        return this.val();
                    };
                }
            }
            if (!setting.setValueCallback) {
                if (setting.dataType === "number") {
                    setting.setValueCallback = function (value) {
                        this.val(value.toString());
                    };
                } else {
                    setting.setValueCallback = function (value) {
                        this.val(value);
                    };
                }
            }
        }
    };

    //for CHECKBOX
    $.dataBinding.dataBind.checkboxBuilder = function (setting) {
        if (this.is("input:checkbox")) {
            if (!setting.dataType) {
                var data = $.notifyProp(setting.dataContext, setting.path)
                setting.dataType = typeof data;
            }
            if (!setting.triggerEvent)
                setting.triggerEvent = "change";
            if (!setting.getValueCallback) {
                switch (setting.dataType) {
                    case "boolean":
                        setting.getValueCallback = function () {
                            return this.is(":checked");
                        };
                        break;
                    case "number":
                        setting.getValueCallback = function () {
                            return (this.is(":checked") ? parseInt(this.val()) : 0);
                        };
                        break;
                    default:
                        setting.getValueCallback = function () {
                            return (this.is(":checked") ? this.val() : null);
                        };
                        break;
                }
            }
            if (!setting.setValueCallback) {
                setting.setValueCallback = function (value) {
                    this.attr("checked", !!value);
                };
            }
        }
    };

    //for RADIO
    $.dataBinding.dataBind.radioBuilder = function (setting) {
        if (this.is("input:radio")) {
            if (!setting.dataType) {
                var data = $.notifyProp(setting.dataContext, setting.path)
                setting.dataType = typeof data;
            }
            if (!setting.triggerEvent)
                setting.triggerEvent = "change";
            if (!setting.getValueCallback) {
                if (setting.dataType === "number") {
                    setting.getValueCallback = function () {
                        if (this.is(":checked"))
                            return parseInt(this.val());
                    };
                } else {
                    setting.getValueCallback = function () {
                        if (this.is(":checked"))
                            return this.val();
                    };
                }
            }

            if (!setting.setValueCallback) {
                if (setting.dataType === "number") {
                    setting.setValueCallback = function (value) {
                        if (parseInt(this.val()) == value)
                            this.attr("checked", true);
                    };
                } else {
                    setting.setValueCallback = function (value) {
                        if (this.val() === value)
                            this.attr("checked", true);
                    };
                }
            }
        }
    };

    //for slider
    $.dataBinding.dataBind.sliderBuilder = function (setting) {
        if (this.hasClass("ui-slider")) {
            if (!setting.triggerEvent)
                setting.triggerEvent = "slide";
            if (!setting.getValueCallback) {
                setting.getValueCallback = function () {
                    if (arguments.caller.length > 1)
                        return arguments.caller[1].value;
                    else
                        return this.slider("value");
                };
            }
            if (!setting.setValueCallback) {
                setting.setValueCallback = function (value) {
                    this.slider("value", value);
                };
            }
        }
    };

    //default builder
    if ($.fn.tmpl)
        $.dataBinding.dataBind.builder.push($.dataBinding.dataBind.templateBuilder);
    if ($.fn.datepicker)
        $.dataBinding.dataBind.builder.push($.dataBinding.dataBind.datePickerBuilder);
    if ($.fn.slider)
        $.dataBinding.dataBind.builder.push($.dataBinding.dataBind.sliderBuilder);
    $.dataBinding.dataBind.builder.push($.dataBinding.dataBind.inputBuilder);
    $.dataBinding.dataBind.builder.push($.dataBinding.dataBind.checkboxBuilder);
    $.dataBinding.dataBind.builder.push($.dataBinding.dataBind.radioBuilder);

    //set if implement underscore.js
    if (_ && _.mixin) {
        _.mixin({
            notifyProp: $.notifyProp,
            notifyCol: $.notifyCol
        });
    }
})(jQuery);